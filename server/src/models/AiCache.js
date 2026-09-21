import mongoose from 'mongoose';
const aiCacheSchema = new mongoose.Schema({
  cacheKey: { type: String, required: true, unique: true, index: true },
  purpose: { type: String, enum: ['email_classification', 'document_roles', 'document_fields'], required: true },
  model: { type: String, required: true },
  promptVersion: { type: String, required: true },
  schemaVersion: { type: String, default: null },
  sourceHash: { type: String, required: true },
  result: { type: mongoose.Schema.Types.Mixed, required: true },
  responseId: { type: String, default: null },
  usage: { type: mongoose.Schema.Types.Mixed, default: null },
  hitCount: { type: Number, min: 0, default: 0 },
  lastHitAt: { type: Date, default: null }
}, { timestamps: true });

export const AiCache = mongoose.models.AiCache ?? mongoose.model('AiCache', aiCacheSchema);
export default AiCache;
