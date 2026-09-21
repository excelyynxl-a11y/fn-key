import mongoose from 'mongoose';
import { REVIEW_REASONS } from '../constants/challenge.js';

const reviewCaseSchema = new mongoose.Schema({
  reviewId: { type: String, required: true, unique: true, index: true },
  runId: { type: String, required: true, index: true },
  emailId: { type: String, required: true, index: true },
  reviewReason: { type: String, enum: REVIEW_REASONS, required: true, index: true },
  stage: {
    type: String,
    enum: ['attachment', 'readability', 'document_role', 'field'],
    required: true,
    index: true
  },
  status: { type: String, enum: ['open', 'resolved'], default: 'open', index: true },
  attempts: { type: [mongoose.Schema.Types.Mixed], default: [] },
  resolution: { type: mongoose.Schema.Types.Mixed, default: null },
  resolvedAt: { type: Date, default: null }
}, { timestamps: true, minimize: false });

reviewCaseSchema.index({ runId: 1, emailId: 1 }, { unique: true });

export const ReviewCase = mongoose.models.ReviewCase ?? mongoose.model('ReviewCase', reviewCaseSchema);
export default ReviewCase;
