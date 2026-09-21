import AuditEvent from '../models/AuditEvent.js';
import KnowledgePhrase from '../models/KnowledgePhrase.js';
import { DOCUMENT_KNOWLEDGE_SEEDS } from '../seeds/documentKnowledge.js';
import { normalizePhrase, tokenCount } from './phraseKnowledgeService.js';

export async function seedDocumentKnowledge({
  knowledgeModel = KnowledgePhrase,
  auditModel = AuditEvent
} = {}) {
  const operations = DOCUMENT_KNOWLEDGE_SEEDS.map((seed) => {
    const normalizedPhrase = normalizePhrase(seed.phrase);
    return {
      updateOne: {
        filter: { kind: seed.kind, target: seed.target, normalizedPhrase },
        update: { $set: { ...seed, normalizedPhrase, tokenCount: tokenCount(seed.phrase) } },
        upsert: true
      }
    };
  });
  const result = await knowledgeModel.bulkWrite(operations, { ordered: false });
  const seeded = result.upsertedCount ?? 0;
  if (seeded > 0) {
    await auditModel.create({
      eventType: 'knowledge.seeded', entityType: 'knowledge_version', entityId: 'document-knowledge',
      details: { inserted: seeded, total: operations.length }
    });
  }
  return { seeded, total: operations.length };
}

export function statusUpdateForAction(entry, action) {
  if (action === 'promote') return { status: 'trusted', weight: Math.max(entry.weight, 4) };
  if (action === 'block') return { status: 'blocked' };
  if (action === 'retire') return { status: 'retired' };
  if (action === 'restore') return { status: entry.source === 'team_seed' ? 'seed' : 'probation' };
  const error = new Error(`Unsupported knowledge action: ${action}`);
  error.statusCode = 400;
  throw error;
}

export async function updateKnowledgeStatus(id, { action, note, reviewer }, {
  knowledgeModel = KnowledgePhrase,
  auditModel = AuditEvent
} = {}) {
  const entry = await knowledgeModel.findById(id).lean();
  if (!entry) return null;
  const update = statusUpdateForAction(entry, action);
  const updated = await knowledgeModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
  await auditModel.create({
    eventType: `knowledge.${action}`,
    entityType: 'knowledge_phrase',
    entityId: String(id),
    details: {
      reviewer, note,
      before: { status: entry.status, weight: entry.weight },
      after: { status: updated.status, weight: updated.weight },
      kind: entry.kind, target: entry.target, phrase: entry.phrase
    }
  });
  return updated;
}
