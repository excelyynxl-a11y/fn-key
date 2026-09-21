import AuditEvent from '../models/AuditEvent.js';
import KnowledgePhrase from '../models/KnowledgePhrase.js';
import { EMAIL_CATEGORY_SEEDS } from '../seeds/emailCategoryPhrases.js';

export function normalizePhrase(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[_/\\|]+/g, ' ')
    .replace(/[^\p{L}\p{N}'&%+.-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenCount(phrase) {
  return normalizePhrase(phrase).split(' ').filter(Boolean).length;
}

export async function seedEmailCategoryPhrases({
  knowledgeModel = KnowledgePhrase,
  auditModel = AuditEvent
} = {}) {
  const operations = EMAIL_CATEGORY_SEEDS.map((seed) => {
    const normalizedPhrase = normalizePhrase(seed.phrase);
    return {
      updateOne: {
        filter: { kind: seed.kind, target: seed.target, normalizedPhrase },
        update: {
          $set: {
            ...seed,
            normalizedPhrase,
            tokenCount: tokenCount(normalizedPhrase)
          }
        },
        upsert: true
      }
    };
  });

  if (operations.length === 0) return { seeded: 0 };
  const result = await knowledgeModel.bulkWrite(operations, { ordered: false });
  const seeded = result.upsertedCount ?? 0;
  if (seeded > 0 && auditModel?.create) {
    await auditModel.create({
      eventType: 'knowledge.seeded',
      entityType: 'knowledge_version',
      entityId: EMAIL_CATEGORY_SEEDS[0].sourceVersion,
      details: { inserted: seeded, total: operations.length }
    });
  }
  return { seeded, total: operations.length };
}

export async function loadActiveEmailPhrases(knowledgeModel = KnowledgePhrase) {
  return knowledgeModel.find({
    kind: 'email_category',
    status: { $in: ['seed', 'probation', 'trusted'] }
  }).sort({ tokenCount: -1, normalizedPhrase: 1 }).lean();
}
