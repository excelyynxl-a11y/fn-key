import { createHash } from 'node:crypto';
import { zodTextFormat } from 'openai/helpers/zod';
import { classificationConfig } from '../constants/classification.js';
import { CLASSIFICATION_PROMPT_VERSION } from '../constants/challenge.js';
import { createOpenAiClient } from '../config/openai.js';
import AiCache from '../models/AiCache.js';
import { aiEmailClassificationSchema } from '../schemas/aiSchemas.js';

const CLASSIFICATION_INSTRUCTIONS = `Classify one shipping-operations inbox email into exactly one category:
- BL_COMPARISON: asks to check, verify, confirm, or amend a draft bill of lading against shipping instructions.
- SI_REQUEST: asks to create, prepare, send, or process a shipping instruction, without asking for an SI-versus-BL comparison.
- INVOICE_QUERY: concerns invoices, billing, charges, freight cost, payment, or invoice cancellation.
- SPAM: unsolicited, deceptive, promotional, phishing, prize, or unrelated investment content.
- GENERAL: legitimate operational or administrative content that does not fit a stronger category.

Use the current message only. Quoted history can provide context but must not override the current request. Return short evidence phrases copied character-for-character from the supplied subject or body. Do not return email addresses, phone numbers, names, shipment IDs, booking numbers, or long copied blocks as evidence.`;

function safeEmailInput(email) {
  return `SUBJECT:\n${String(email.subject ?? '')}\n\nBODY:\n${String(email.body ?? '')}`;
}

function sourceText(email) {
  return `${String(email.subject ?? '')}\n${String(email.body ?? '')}`;
}

export function validateAiEvidence(result, email) {
  const validated = aiEmailClassificationSchema.parse(result);
  const source = sourceText(email);
  const invalid = validated.evidencePhrases.filter((phrase) => !source.includes(phrase));
  if (invalid.length > 0) {
    const error = new Error('AI evidence must be copied verbatim from the email');
    error.code = 'AI_EVIDENCE_INVALID';
    error.retryable = false;
    throw error;
  }
  return validated;
}

export function classificationCacheKey(email, model) {
  return createHash('sha256')
    .update(JSON.stringify({
      purpose: 'email_classification',
      promptVersion: CLASSIFICATION_PROMPT_VERSION,
      model,
      subject: email.subject ?? '',
      body: email.body ?? ''
    }))
    .digest('hex');
}

function isTransient(error) {
  const status = Number(error?.status ?? error?.statusCode);
  return [408, 409, 429].includes(status)
    || status >= 500
    || ['ETIMEDOUT', 'ECONNRESET', 'APIConnectionError'].includes(error?.code)
    || error?.name === 'AbortError';
}

function classificationError(error, attempts) {
  const wrapped = new Error(error?.message || 'AI classification failed');
  wrapped.code = error?.code === 'AI_EVIDENCE_INVALID' ? error.code : 'AI_CLASSIFICATION_FAILED';
  wrapped.retryable = isTransient(error);
  wrapped.attempts = attempts;
  return wrapped;
}

export async function classifyEmailWithAi(email, {
  client,
  cacheModel = AiCache,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  config = classificationConfig(),
  model = process.env.OPENAI_MODEL ?? 'gpt-5.5'
} = {}) {
  const cacheKey = classificationCacheKey(email, model);
  const cached = await cacheModel.findOne({ cacheKey }).lean();
  if (cached) {
    await cacheModel.updateOne({ cacheKey }, { $inc: { hitCount: 1 }, $set: { lastHitAt: new Date() } });
    return { ...cached.result, cacheHit: true, responseId: cached.responseId, usage: cached.usage, attempts: 0 };
  }

  const openai = client ?? createOpenAiClient();
  let lastError;
  for (let attempt = 1; attempt <= config.maximumAiAttempts; attempt += 1) {
    try {
      const response = await openai.responses.parse({
        model,
        instructions: CLASSIFICATION_INSTRUCTIONS,
        input: safeEmailInput(email),
        text: { format: zodTextFormat(aiEmailClassificationSchema, 'email_classification') },
        store: false
      }, { signal: AbortSignal.timeout(config.aiTimeoutMs) });

      if (response.status !== 'completed' || !response.output_parsed) {
        const error = new Error(response.status === 'incomplete'
          ? `AI response incomplete: ${response.incomplete_details?.reason ?? 'unknown reason'}`
          : 'AI response did not contain parsed output');
        error.code = 'AI_RESPONSE_INCOMPLETE';
        error.retryable = response.status === 'incomplete';
        throw error;
      }

      const result = validateAiEvidence(response.output_parsed, email);
      const sourceHash = createHash('sha256').update(sourceText(email)).digest('hex');
      await cacheModel.updateOne({ cacheKey }, {
        $setOnInsert: {
          cacheKey,
          purpose: 'email_classification',
          model,
          promptVersion: CLASSIFICATION_PROMPT_VERSION,
          sourceHash,
          result,
          responseId: response.id ?? null,
          usage: response.usage ?? null,
          hitCount: 0
        }
      }, { upsert: true });
      return {
        ...result,
        cacheHit: false,
        responseId: response.id ?? null,
        usage: response.usage ?? null,
        attempts: attempt
      };
    } catch (error) {
      lastError = error;
      const retryable = error?.retryable ?? isTransient(error);
      if (!retryable || attempt === config.maximumAiAttempts) break;
      await wait(250 * (2 ** (attempt - 1)));
    }
  }
  throw classificationError(lastError, config.maximumAiAttempts);
}
