import mongoose from 'mongoose';

const countSchema = new mongoose.Schema({
  total: { type: Number, min: 0, default: 0 },
  queued: { type: Number, min: 0, default: 0 },
  processed: { type: Number, min: 0, default: 0 },
  classified: { type: Number, min: 0, default: 0 },
  ruleClassified: { type: Number, min: 0, default: 0 },
  aiClassified: { type: Number, min: 0, default: 0 },
  aiCacheHits: { type: Number, min: 0, default: 0 },
  compared: { type: Number, min: 0, default: 0 },
  mismatched: { type: Number, min: 0, default: 0 },
  review: { type: Number, min: 0, default: 0 },
  failed: { type: Number, min: 0, default: 0 }
}, { _id: false });

const processingRunSchema = new mongoose.Schema({
  runId: { type: String, required: true, unique: true, index: true },
  source: { type: String, required: true, default: 'bundle' },
  state: {
    type: String,
    enum: ['queued', 'running', 'completed', 'completed_with_errors', 'failed'],
    default: 'queued',
    index: true
  },
  pipelineVersion: { type: String, required: true },
  emailIds: { type: [String], default: [] },
  counts: { type: countSchema, default: () => ({}) },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  runErrors: [{
    emailId: { type: String, default: null },
    code: { type: String, required: true },
    message: { type: String, required: true }
  }]
}, { timestamps: true });

processingRunSchema.index({ createdAt: -1 });

export const ProcessingRun = mongoose.models.ProcessingRun
  ?? mongoose.model('ProcessingRun', processingRunSchema);
export default ProcessingRun;
