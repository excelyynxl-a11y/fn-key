import mongoose from 'mongoose';
import { EMAIL_CATEGORIES } from '../constants/challenge.js';

const aiCacheSchema = new mongoose.Schema({
  cacheKey: { type: String, required: true, unique: true, index: true },
  purpose: { type: String, enum: ['email_classification'], required: true },
  model: { type: String, required: true },
  promptVersion: { type: String, required: true },
  sourceHash: { type: String, required: true },
  result: {
    category: { type: String, enum: EMAIL_CATEGORIES, required: true },
    reason: { type: String, required: true },
    evidencePhrases: { type: [String], required: true },
    confidence: { type: Number, min: 0, max: 1, required: true }
  },
  responseId: { type: String, default: null },
  usage: { type: mongoose.Schema.Types.Mixed, default: null },
  hitCount: { type: Number, min: 0, default: 0 },
  lastHitAt: { type: Date, default: null }
}, { timestamps: true });

export const AiCache = mongoose.models.AiCache ?? mongoose.model('AiCache', aiCacheSchema);
export default AiCache;
