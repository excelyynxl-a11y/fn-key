import { createHash } from 'node:crypto';
import { zodTextFormat } from 'openai/helpers/zod';
import { createOpenAiClient } from '../config/openai.js';
import { classificationConfig } from '../constants/classification.js';
import {
  DOCUMENT_AI_SCHEMA_VERSION,
  DOCUMENT_FIELD_PROMPT_VERSION,
  DOCUMENT_ROLE_PROMPT_VERSION
} from '../constants/challenge.js';
import AiCache from '../models/AiCache.js';
import { aiDocumentFieldSchema, aiDocumentRoleSchema } from '../schemas/aiSchemas.js';
import { FIELD_NORMALIZERS } from './normalizationService.js';

const ROLE_INSTRUCTIONS = `Identify the role of each supplied shipping attachment.
Use SI for a shipping instruction or bill-of-lading instruction, BL for an issued or draft bill of lading, and UNKNOWN for every other document.
Return exactly one decision for every attachment reference. Evidence must be a short, exact substring from that attachment's supplied text. Never infer a role from shipment values.`;

const FIELD_INSTRUCTIONS = `Extract only the requested canonical fields from one shipping document.
Return exactly one result for every requested field and no other fields. Copy rawValue, sourceLabel, and evidence exactly from the supplied document. Set missing=true and all three text values to null when the value is absent or uncertain. Do not calculate, repair, or invent a shipment value. Location is the supplied page, sheet/cell, or line when visible, otherwise null.`;

const MINIMUM_DOCUMENT_AI_CONFIDENCE = 0.75;

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sourceHashForAttachment(attachment) {
  if (attachment.buffer) return hash(attachment.buffer);
  return hash(attachment.parsedDocument?.text ?? attachment.extractedText ?? '');
}

export function documentAiCacheKey({ purpose, model, promptVersion, sourceHash, requestedFields = [] }) {
  return hash(JSON.stringify({
    purpose,
    model,
    promptVersion,
    schemaVersion: DOCUMENT_AI_SCHEMA_VERSION,
    sourceHash,
    requestedFields: [...requestedFields].sort()
  }));
}

function isTransient(error) {
  const status = Number(error?.status ?? error?.statusCode);
  return [408, 409, 429].includes(status)
    || status >= 500
    || ['ETIMEDOUT', 'ECONNRESET', 'APIConnectionError'].includes(error?.code)
    || error?.name === 'AbortError';
}

async function parsedResponse({
  client,
  instructions,
  input,
  schema,
  schemaName,
  config,
  wait
}) {
  let lastError;
  for (let attempt = 1; attempt <= config.maximumAiAttempts; attempt += 1) {
    try {
      const response = await client.responses.parse({
        model: config.model,
        instructions,
        input,
        text: { format: zodTextFormat(schema, schemaName) },
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
      return { response, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (!(error?.retryable ?? isTransient(error)) || attempt === config.maximumAiAttempts) break;
      await wait(250 * (2 ** (attempt - 1)));
    }
  }
  const error = new Error(lastError?.message ?? 'Document AI fallback failed');
  error.code = lastError?.code?.startsWith?.('AI_') ? lastError.code : 'AI_DOCUMENT_FAILED';
  error.retryable = isTransient(lastError);
  error.cause = lastError;
  throw error;
}

function runtimeOptions(options) {
  const base = options.config ?? classificationConfig();
  return {
    ...base,
    model: options.model ?? process.env.OPENAI_MODEL ?? 'gpt-5.5'
  };
}

function roleInput(attachments) {
  return attachments.map((attachment) => {
    const text = attachment.parsedDocument?.text ?? attachment.extractedText ?? '';
    const header = String(text).split(/\r?\n/).slice(0, 80).join('\n').slice(0, 12_000);
    return `ATTACHMENT: ${attachment.reference}\nTEXT:\n${header}`;
  }).join('\n\n---\n\n');
}

function validateRoleResult(value, attachments) {
  const result = aiDocumentRoleSchema.parse(value);
  const byReference = new Map(attachments.map((attachment) => [attachment.reference, attachment]));
  if (result.documents.length !== attachments.length
    || new Set(result.documents.map(({ attachmentReference }) => attachmentReference)).size !== attachments.length) {
    throw Object.assign(new Error('AI must return one unique role for every attachment'), {
      code: 'AI_ROLE_INVALID', retryable: false
    });
  }
  for (const decision of result.documents) {
    const attachment = byReference.get(decision.attachmentReference);
    const source = attachment?.parsedDocument?.text ?? attachment?.extractedText ?? '';
    if (!attachment || !source.includes(decision.evidence)) {
      throw Object.assign(new Error('AI role evidence must be copied from the matching attachment'), {
        code: 'AI_EVIDENCE_INVALID', retryable: false
      });
    }
  }
  return result;
}

async function readCache(cacheModel, cacheKey, validator) {
  const cached = await cacheModel.findOne({ cacheKey }).lean();
  if (!cached) return null;
  const result = validator(cached.result);
  await cacheModel.updateOne({ cacheKey }, { $inc: { hitCount: 1 }, $set: { lastHitAt: new Date() } });
  return { result, responseId: cached.responseId, usage: cached.usage, cacheHit: true, attempts: 0 };
}

async function writeCache(cacheModel, record) {
  await cacheModel.updateOne({ cacheKey: record.cacheKey }, {
    $setOnInsert: { ...record, hitCount: 0 }
  }, { upsert: true });
}

export async function detectDocumentRolesWithAi(attachments, options = {}) {
  const config = runtimeOptions(options);
  const cacheModel = options.cacheModel ?? AiCache;
  const combinedHash = hash(attachments
    .map((attachment) => `${attachment.reference}:${sourceHashForAttachment(attachment)}`)
    .join('|'));
  const cacheKey = documentAiCacheKey({
    purpose: 'document_roles',
    model: config.model,
    promptVersion: DOCUMENT_ROLE_PROMPT_VERSION,
    sourceHash: combinedHash
  });
  const validate = (value) => validateRoleResult(value, attachments);
  const cached = await readCache(cacheModel, cacheKey, validate);
  let envelope = cached;
  if (!envelope) {
    const client = options.client ?? createOpenAiClient();
    const { response, attempts } = await parsedResponse({
      client,
      instructions: ROLE_INSTRUCTIONS,
      input: roleInput(attachments),
      schema: aiDocumentRoleSchema,
      schemaName: 'document_roles',
      config,
      wait: options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)))
    });
    const result = validate(response.output_parsed);
    await writeCache(cacheModel, {
      cacheKey,
      purpose: 'document_roles',
      model: config.model,
      promptVersion: DOCUMENT_ROLE_PROMPT_VERSION,
      schemaVersion: DOCUMENT_AI_SCHEMA_VERSION,
      sourceHash: combinedHash,
      result,
      responseId: response.id ?? null,
      usage: response.usage ?? null
    });
    envelope = {
      result,
      responseId: response.id ?? null,
      usage: response.usage ?? null,
      cacheHit: false,
      attempts
    };
  }

  const decisions = new Map(envelope.result.documents.map((decision) => [decision.attachmentReference, decision]));
  const identified = attachments.map((attachment) => {
    const decision = decisions.get(attachment.reference);
    return {
      ...attachment,
      documentType: decision.role,
      roleMethod: 'ai',
      roleConfidence: decision.confidence,
      roleEvidence: [{ source: 'content', phrase: decision.evidence, role: decision.role, score: decision.confidence }]
    };
  });
  const si = identified.filter(({ documentType, roleConfidence }) => (
    documentType === 'SI' && roleConfidence >= MINIMUM_DOCUMENT_AI_CONFIDENCE
  ));
  const bl = identified.filter(({ documentType, roleConfidence }) => (
    documentType === 'BL' && roleConfidence >= MINIMUM_DOCUMENT_AI_CONFIDENCE
  ));
  return {
    si: si.length === 1 ? si[0] : null,
    bl: bl.length === 1 ? bl[0] : null,
    valid: si.length === 1 && bl.length === 1,
    ambiguous: si.length !== 1 || bl.length !== 1,
    attachments: identified,
    aiMetadata: envelope
  };
}

function locationLabel(location = {}) {
  return [
    location.page ? `page ${location.page}` : null,
    location.sheet ? `sheet ${location.sheet}` : null,
    location.cell ? `cell ${location.cell}` : null,
    location.line ? `line ${location.line}` : null
  ].filter(Boolean).join(', ') || 'location unavailable';
}

function fieldInput(attachment, requestedFields) {
  const parsed = attachment.parsedDocument ?? {};
  const locatedText = parsed.lines?.length
    ? parsed.lines.map((line) => `[${locationLabel(line.location ?? line)}] ${line.text}`).join('\n')
    : parsed.text ?? attachment.extractedText ?? '';
  const text = String(locatedText).slice(0, 30_000);
  const requestText = `ATTACHMENT: ${attachment.reference}\nREQUESTED FIELDS: ${requestedFields.join(', ')}\nDOCUMENT TEXT:\n${text || '[No embedded text; inspect the attached file.]'}`;
  const includeFile = Boolean(attachment.buffer) && (parsed.format === 'pdf' || parsed.scanned || !text.trim());
  if (!includeFile) return requestText;
  const mimeType = parsed.mimeType ?? attachment.detectedMimeType ?? 'application/pdf';
  return [{
    role: 'user',
    content: [
      { type: 'input_text', text: requestText },
      {
        type: 'input_file',
        filename: attachment.filename ?? attachment.reference.split('/').pop(),
        file_data: `data:${mimeType};base64,${attachment.buffer.toString('base64')}`
      }
    ]
  }];
}

function validateFieldResult(value, attachment, requestedFields) {
  const result = aiDocumentFieldSchema.parse(value);
  const requested = new Set(requestedFields);
  if (result.fields.length !== requested.size
    || new Set(result.fields.map(({ field }) => field)).size !== requested.size
    || result.fields.some(({ field }) => !requested.has(field))) {
    throw Object.assign(new Error('AI must return exactly the requested document fields'), {
      code: 'AI_FIELDS_INVALID', retryable: false
    });
  }
  const source = attachment.parsedDocument?.text ?? attachment.extractedText ?? '';
  for (const field of result.fields) {
    if (field.missing) {
      if (field.rawValue !== null || field.sourceLabel !== null || field.evidence !== null) {
        throw Object.assign(new Error('Missing AI fields must not contain values'), {
          code: 'AI_FIELDS_INVALID', retryable: false
        });
      }
      continue;
    }
    if (!field.rawValue || !field.sourceLabel || !field.evidence) {
      throw Object.assign(new Error('Extracted AI fields require a value, label, and evidence'), {
        code: 'AI_FIELDS_INVALID', retryable: false
      });
    }
    if (source && (
      !source.includes(field.evidence)
      || !field.evidence.includes(field.rawValue)
      || !field.evidence.includes(field.sourceLabel)
    )) {
      throw Object.assign(new Error('AI field evidence must be copied from the document and contain the value'), {
        code: 'AI_EVIDENCE_INVALID', retryable: false
      });
    }
  }
  return result;
}

function fieldMap(result, attachment) {
  const source = attachment.parsedDocument?.text ?? attachment.extractedText ?? '';
  return Object.fromEntries(result.fields.map((field) => {
    if (field.missing) return [field.field, null];
    const evidenceVerified = Boolean(source) && source.includes(field.evidence);
    const evidenceLine = attachment.parsedDocument?.lines?.find((line) => (
      line.text.includes(field.evidence)
      || field.evidence.includes(line.text)
      || line.text.includes(field.rawValue)
    ));
    const confidenceAccepted = evidenceVerified && field.confidence >= MINIMUM_DOCUMENT_AI_CONFIDENCE;
    return [field.field, {
      rawValue: field.rawValue,
      normalizedValue: confidenceAccepted ? FIELD_NORMALIZERS[field.field](field.rawValue) : null,
      sourceLabel: field.sourceLabel,
      evidence: field.evidence,
      location: evidenceLine?.location ?? field.location,
      method: 'ai',
      confidence: evidenceVerified ? field.confidence : Math.min(field.confidence, 0.65),
      evidenceVerified,
      candidates: [],
      ambiguous: false
    }];
  }));
}

export async function extractDocumentFieldsWithAi(attachment, requestedFields, options = {}) {
  const uniqueFields = [...new Set(requestedFields)];
  if (uniqueFields.length === 0) return { fields: {}, cacheHit: false, attempts: 0 };
  const config = runtimeOptions(options);
  const cacheModel = options.cacheModel ?? AiCache;
  const sourceHash = sourceHashForAttachment(attachment);
  const cacheKey = documentAiCacheKey({
    purpose: 'document_fields',
    model: config.model,
    promptVersion: DOCUMENT_FIELD_PROMPT_VERSION,
    sourceHash,
    requestedFields: uniqueFields
  });
  const validate = (value) => validateFieldResult(value, attachment, uniqueFields);
  const cached = await readCache(cacheModel, cacheKey, validate);
  let envelope = cached;
  if (!envelope) {
    const client = options.client ?? createOpenAiClient();
    const { response, attempts } = await parsedResponse({
      client,
      instructions: FIELD_INSTRUCTIONS,
      input: fieldInput(attachment, uniqueFields),
      schema: aiDocumentFieldSchema,
      schemaName: 'document_fields',
      config,
      wait: options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)))
    });
    const result = validate(response.output_parsed);
    await writeCache(cacheModel, {
      cacheKey,
      purpose: 'document_fields',
      model: config.model,
      promptVersion: DOCUMENT_FIELD_PROMPT_VERSION,
      schemaVersion: DOCUMENT_AI_SCHEMA_VERSION,
      sourceHash,
      result,
      responseId: response.id ?? null,
      usage: response.usage ?? null
    });
    envelope = {
      result,
      responseId: response.id ?? null,
      usage: response.usage ?? null,
      cacheHit: false,
      attempts
    };
  }
  return {
    fields: fieldMap(envelope.result, attachment),
    cacheHit: envelope.cacheHit,
    responseId: envelope.responseId,
    usage: envelope.usage,
    attempts: envelope.attempts
  };
}
