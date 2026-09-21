import mongoose from 'mongoose';
import { COMPARISON_FIELDS, EMAIL_CATEGORIES, KNOWLEDGE_STATUSES } from '../constants/challenge.js';

const knowledgePhraseSchema = new mongoose.Schema({
  kind: { type: String, enum: ['email_category', 'document_label', 'field_alias'], required: true, index: true },
  target: { type: String, enum: [...EMAIL_CATEGORIES, 'SI', 'BL', ...COMPARISON_FIELDS], required: true, index: true },
  phrase: { type: String, required: true },
  normalizedPhrase: { type: String, required: true, index: true },
  tokenCount: { type: Number, min: 1, required: true },
  allowedLocations: [{ type: String, enum: ['subject', 'body', 'filename', 'header', 'line', 'cell'] }],
  weight: { type: Number, min: 0, required: true },
  status: { type: String, enum: KNOWLEDGE_STATUSES, required: true, index: true },
  source: { type: String, enum: ['team_seed', 'ai', 'human'], required: true },
  sourceVersion: { type: String, required: true },
  supportCount: { type: Number, min: 0, default: 0 },
  conflictCount: { type: Number, min: 0, default: 0 },
  usageCount: { type: Number, min: 0, default: 0 },
  supportSources: { type: [String], default: [] },
  sourceEmailId: { type: String, default: null },
  lastUsedAt: { type: Date, default: null },
  lastSupportedAt: { type: Date, default: null }
}, { timestamps: true });

knowledgePhraseSchema.index(
  { kind: 1, target: 1, normalizedPhrase: 1 },
  { unique: true }
);

export const KnowledgePhrase = mongoose.models.KnowledgePhrase
  ?? mongoose.model('KnowledgePhrase', knowledgePhraseSchema);
export default KnowledgePhrase;
