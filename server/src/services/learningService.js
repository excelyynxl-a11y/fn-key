import { CLASSIFICATION_DEFAULTS, GENERIC_PHRASES } from '../constants/classification.js';
import { KNOWLEDGE_VERSION } from '../constants/challenge.js';
import AuditEvent from '../models/AuditEvent.js';
import KnowledgePhrase from '../models/KnowledgePhrase.js';
import { normalizePhrase, tokenCount } from './phraseKnowledgeService.js';

const FORBIDDEN_PATTERNS = [
  /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i,
  /(?:\+?\d[\d\s().-]{7,}\d)/,
  /\b(?:5[A-Z]{2,4}-?\d{3,}|[A-Z]{3,}\d{5,})\b/i,
  /https?:\/\//i
];

const CATEGORY_RELEVANCE_PATTERNS = Object.freeze({
  BL_COMPARISON: [
    /\b(?:si|shipping instruction).{0,40}\b(?:bl|bill of lading)\b/i,
    /\b(?:bl|bill of lading).{0,40}\b(?:si|shipping instruction)\b/i,
    /\b(?:check|confirm|compare|verify|amend|review|send).{0,24}\b(?:draft )?(?:bl|bill of lading)\b/i,
    /\b(?:draft )?(?:bl|bill of lading).{0,24}\b(?:check|confirm|compare|verify|amend|review)\b/i
  ],
  SI_REQUEST: [
    /\b(?:prepare|create|submit|send|provide|request|need(?:ed)?).{0,24}\b(?:si|shipping instruction)\b/i,
    /\b(?:si|shipping instruction).{0,24}\b(?:prepare|create|submit|send|provide|request|need(?:ed)?)\b/i
  ],
  INVOICE_QUERY: [/\b(?:invoice|billing|billed|charges?|freight|payment|credit note)\b/i],
  SPAM: [/\b(?:prize|winner|won|gift card|limited time offer|investment|returns|verify (?:your )?account|customs fee|bank details|deactivation)\b/i],
  GENERAL: [/\b(?:no action required|status update|schedule update|sailing schedule|loading completed|berthing report|office resumes|time off)\b/i]
});

export function validateLearnedPhrase(phrase, email, category = null) {
  const source = `${email.subject ?? ''}\n${email.body ?? ''}`;
  if (!source.includes(phrase)) return { valid: false, reason: 'not_verbatim' };
  const normalizedPhrase = normalizePhrase(phrase);
  const words = tokenCount(normalizedPhrase);
  if (words < 2) return { valid: false, reason: 'too_short' };
  if (words > CLASSIFICATION_DEFAULTS.maximumLearnedPhraseWords || phrase.length > 120) {
    return { valid: false, reason: 'too_long' };
  }
  if (GENERIC_PHRASES.includes(normalizedPhrase)) return { valid: false, reason: 'generic' };
  if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(phrase))) {
    return { valid: false, reason: 'sensitive_or_shipment_specific' };
  }
  if (category && !CATEGORY_RELEVANCE_PATTERNS[category]?.some((pattern) => pattern.test(phrase))) {
    return { valid: false, reason: 'not_category_specific' };
  }
  return { valid: true, normalizedPhrase, tokenCount: words };
}

async function enforceCategoryCap(target, knowledgeModel, auditModel) {
  const active = await knowledgeModel.find({
    kind: 'email_category', target, status: { $in: ['seed', 'probation', 'trusted'] }
  }).sort({ status: 1, supportCount: -1, conflictCount: 1, lastSupportedAt: -1, createdAt: -1 }).lean();
  const excess = active.slice(CLASSIFICATION_DEFAULTS.maxActivePhrasesPerCategory);
  if (excess.length === 0) return;
  const ids = excess.map(({ _id }) => _id);
  await knowledgeModel.updateMany({ _id: { $in: ids } }, { $set: { status: 'retired' } });
  await auditModel.insertMany(excess.map((entry) => ({
    eventType: 'knowledge.retired',
    entityType: 'knowledge_phrase',
    entityId: entry._id.toString(),
    details: { reason: 'category_cap', target }
  })));
}

export async function learnClassificationPhrases({
  email,
  category,
  evidencePhrases,
  responseId = null,
  source = 'ai',
  knowledgeModel = KnowledgePhrase,
  auditModel = AuditEvent
}) {
  const outcomes = [];
  for (const phrase of evidencePhrases) {
    const validation = validateLearnedPhrase(phrase, email, category);
    if (!validation.valid) {
      outcomes.push({ phrase, accepted: false, reason: validation.reason });
      continue;
    }

    const conflict = await knowledgeModel.findOne({
      kind: 'email_category',
      target: { $ne: category },
      normalizedPhrase: validation.normalizedPhrase,
      status: { $in: ['seed', 'probation', 'trusted'] }
    }).lean();
    if (conflict) {
      await knowledgeModel.updateOne({ _id: conflict._id }, { $inc: { conflictCount: 1 } });
      outcomes.push({ phrase, accepted: false, reason: 'cross_category_conflict' });
      continue;
    }

    let existing = await knowledgeModel.findOne({
      kind: 'email_category', target: category, normalizedPhrase: validation.normalizedPhrase
    }).lean();
    if (existing?.supportSources?.includes(email.emailId)) {
      outcomes.push({ phrase, accepted: true, duplicateSupport: true, status: existing.status });
      continue;
    }

    let entry;
    let eventType;
    if (!existing) {
      try {
        const created = await knowledgeModel.create({
          kind: 'email_category',
          target: category,
          phrase,
          normalizedPhrase: validation.normalizedPhrase,
          tokenCount: validation.tokenCount,
          allowedLocations: ['subject', 'body'],
          weight: 2,
          status: 'probation',
          source,
          sourceVersion: KNOWLEDGE_VERSION,
          sourceEmailId: email.emailId,
          supportCount: 1,
          supportSources: [email.emailId],
          lastSupportedAt: new Date()
        });
        entry = created.toObject ? created.toObject() : created;
        eventType = 'knowledge.created';
      } catch (error) {
        if (error?.code !== 11000) throw error;
        existing = await knowledgeModel.findOne({
          kind: 'email_category', target: category, normalizedPhrase: validation.normalizedPhrase
        }).lean();
      }
    }

    if (!entry && existing) {
      const updated = await knowledgeModel.updateOne({
        _id: existing._id,
        supportSources: { $ne: email.emailId }
      }, {
        $addToSet: { supportSources: email.emailId },
        $inc: { supportCount: 1 },
        $set: { lastSupportedAt: new Date() }
      });
      if (updated.modifiedCount === 0) {
        outcomes.push({ phrase, accepted: true, duplicateSupport: true, status: existing.status });
        continue;
      }
      entry = await knowledgeModel.findOne({ _id: existing._id }).lean();
      eventType = 'knowledge.supported';
      if (entry.status === 'probation' && entry.supportCount >= CLASSIFICATION_DEFAULTS.promotionSupportCount) {
        entry = await knowledgeModel.findOneAndUpdate(
          { _id: entry._id },
          { $set: { status: 'trusted', weight: Math.max(entry.weight, 4) } },
          { new: true }
        ).lean();
        eventType = 'knowledge.promoted';
      }
    }

    await auditModel.create({
      eventType,
      entityType: 'knowledge_phrase',
      entityId: entry._id.toString(),
      emailId: email.emailId,
      details: { category, phrase, responseId, status: entry.status }
    });
    outcomes.push({ phrase, accepted: true, status: entry.status, knowledgeId: entry._id.toString() });
  }

  await enforceCategoryCap(category, knowledgeModel, auditModel);
  return outcomes;
}
