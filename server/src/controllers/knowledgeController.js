import { z } from 'zod';
import AuditEvent from '../models/AuditEvent.js';
import KnowledgePhrase from '../models/KnowledgePhrase.js';
import { updateKnowledgeStatus } from '../services/knowledgeService.js';

const listSchema = z.object({
  kind: z.enum(['email_category', 'document_label', 'field_alias']).optional(),
  status: z.enum(['seed', 'probation', 'trusted', 'blocked', 'retired']).optional(),
  target: z.string().max(100).optional(),
  limit: z.coerce.number().int().positive().max(500).default(200)
});

const updateSchema = z.object({
  action: z.enum(['promote', 'block', 'retire', 'restore']),
  note: z.string().trim().min(3).max(1_000),
  reviewer: z.string().trim().min(1).max(200).default('knowledge-reviewer')
}).strict();

const auditSchema = z.object({ limit: z.coerce.number().int().positive().max(200).default(50) });

export async function listKnowledgeController(req, res) {
  const input = listSchema.parse(req.query);
  const filter = {};
  for (const key of ['kind', 'status', 'target']) if (input[key]) filter[key] = input[key];
  const entries = await KnowledgePhrase.find(filter).sort({ kind: 1, target: 1, status: 1, phrase: 1 }).limit(input.limit).lean();
  res.json({ data: entries, error: null, meta: { total: entries.length } });
}

export async function updateKnowledgeController(req, res) {
  const input = updateSchema.parse(req.body);
  const updated = await updateKnowledgeStatus(req.params.id, input);
  if (!updated) return res.status(404).json({ data: null, error: { code: 'KNOWLEDGE_NOT_FOUND', message: 'Knowledge entry not found', retryable: false }, meta: {} });
  return res.json({ data: updated, error: null, meta: {} });
}

export async function knowledgeAuditController(req, res) {
  const { limit } = auditSchema.parse(req.query);
  const events = await AuditEvent.find({ entityType: { $in: ['knowledge_phrase', 'knowledge_version'] } })
    .sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ data: events, error: null, meta: { total: events.length } });
}
