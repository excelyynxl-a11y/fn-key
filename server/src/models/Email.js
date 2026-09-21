import mongoose from 'mongoose';
import {
  COMPARISON_FIELDS,
  COMPARISON_STATUSES,
  EMAIL_CATEGORIES,
  REVIEW_REASONS
} from '../constants/challenge.js';

const attachmentSchema = new mongoose.Schema({
  reference: { type: String, required: true },
  filename: { type: String, required: true },
  extension: { type: String, required: true },
  exists: { type: Boolean, required: true },
  size: { type: Number, min: 0, default: null },
  contentHash: { type: String, default: null },
  parserStatus: {
    type: String,
    enum: ['pending', 'parsed', 'unreadable', 'unsupported'],
    default: 'pending'
  },
  detectedFormat: { type: String, enum: ['txt', 'pdf', 'docx', 'xlsx'], default: null },
  detectedMimeType: { type: String, default: null },
  extractedText: { type: String, default: null },
  parserWarnings: { type: [String], default: [] },
  readabilityScore: { type: Number, min: 0, max: 1, default: null },
  scanned: { type: Boolean, default: false },
  parserMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  parserError: {
    code: { type: String, default: null },
    message: { type: String, default: null }
  },
  documentType: { type: String, enum: ['SI', 'BL', 'UNKNOWN'], default: 'UNKNOWN' },
  roleMethod: { type: String, enum: ['rule', 'ai', 'human'], default: null },
  roleConfidence: { type: Number, min: 0, max: 1, default: null },
  roleMargin: { type: Number, default: null },
  roleScores: { type: Map, of: Number, default: {} },
  roleEvidence: { type: [mongoose.Schema.Types.Mixed], default: [] }
}, { _id: false });

const extractedFieldSchema = new mongoose.Schema({
  rawValue: { type: String, default: null },
  normalizedValue: { type: mongoose.Schema.Types.Mixed, default: null },
  sourceLabel: { type: String, default: null },
  evidence: { type: String, default: null },
  location: {
    page: { type: Number, default: null },
    sheet: { type: String, default: null },
    cell: { type: String, default: null },
    line: { type: Number, default: null },
    paragraph: { type: Number, default: null },
    table: { type: Number, default: null },
    row: { type: Number, default: null },
    column: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  method: {
    type: String,
    enum: ['alias_rule', 'ai', 'human', 'missing'],
    default: 'missing'
  },
  confidence: { type: Number, min: 0, max: 1, default: 0 },
  evidenceVerified: { type: Boolean, default: null },
  candidates: { type: [mongoose.Schema.Types.Mixed], default: [] },
  ambiguous: { type: Boolean, default: false }
}, { _id: false });

const documentSchema = new mongoose.Schema({
  attachmentReference: { type: String, default: null },
  documentType: { type: String, enum: ['SI', 'BL', 'UNKNOWN'], default: 'UNKNOWN' },
  roleMethod: { type: String, enum: ['rule', 'ai', 'human'], default: null },
  roleConfidence: { type: Number, min: 0, max: 1, default: null },
  roleEvidence: { type: [mongoose.Schema.Types.Mixed], default: [] },
  fields: {
    type: Map,
    of: extractedFieldSchema,
    default: {}
  }
}, { _id: false });

const emailSchema = new mongoose.Schema({
  emailId: { type: String, required: true, unique: true, index: true },
  sourceHash: { type: String, required: true },
  source: {
    from: { type: String, required: true },
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
    attachments: { type: [attachmentSchema], default: [] }
  },
  processingState: {
    type: String,
    enum: ['imported', 'queued', 'processing', 'completed', 'failed'],
    default: 'imported',
    index: true
  },
  classification: {
    category: { type: String, enum: EMAIL_CATEGORIES, default: null },
    method: { type: String, enum: ['rule', 'ai', 'human'], default: null },
    confidence: { type: Number, min: 0, max: 1, default: null },
    reason: { type: String, default: null },
    evidencePhrases: { type: [String], default: [] },
    matchedEvidence: { type: [mongoose.Schema.Types.Mixed], default: [] },
    scores: { type: Map, of: Number, default: {} },
    scoreMargin: { type: Number, default: null },
    cacheHit: { type: Boolean, default: false },
    model: { type: String, default: null },
    responseId: { type: String, default: null },
    promptVersion: { type: String, default: null },
    aiAttempts: { type: Number, min: 0, default: 0 },
    usage: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  documents: {
    si: { type: documentSchema, default: () => ({}) },
    bl: { type: documentSchema, default: () => ({}) }
  },
  result: {
    category: { type: String, enum: EMAIL_CATEGORIES, default: null },
    status: { type: String, enum: COMPARISON_STATUSES, default: null },
    reviewReason: { type: String, enum: REVIEW_REASONS, default: null },
    hasDefect: { type: Boolean, default: false },
    defectFields: [{ type: String, enum: COMPARISON_FIELDS }],
    fieldDetails: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} }
  },
  reviewOverrides: {
    category: { type: String, enum: EMAIL_CATEGORIES, default: null },
    roles: {
      siAttachmentReference: { type: String, default: null },
      blAttachmentReference: { type: String, default: null }
    },
    fields: [{
      documentType: { type: String, enum: ['SI', 'BL'], required: true },
      field: { type: String, enum: COMPARISON_FIELDS, required: true },
      rawValue: { type: String, required: true }
    }],
    note: { type: String, default: null },
    updatedBy: { type: String, default: null },
    updatedAt: { type: Date, default: null }
  },
  failure: {
    code: { type: String, default: null },
    message: { type: String, default: null },
    retryable: { type: Boolean, default: false }
  },
  metrics: {
    durationMs: { type: Number, min: 0, default: null },
    aiFallbacks: {
      classification: { type: Number, min: 0, default: 0 },
      documentRole: { type: Number, min: 0, default: 0 },
      documentFields: { type: Number, min: 0, default: 0 }
    },
    cacheHits: {
      classification: { type: Number, min: 0, default: 0 },
      documentRole: { type: Number, min: 0, default: 0 },
      documentFields: { type: Number, min: 0, default: 0 }
    },
    usage: {
      inputTokens: { type: Number, min: 0, default: 0 },
      outputTokens: { type: Number, min: 0, default: 0 }
    },
    estimatedCostUsd: { type: Number, min: 0, default: 0 },
    processingAttempts: { type: Number, min: 0, default: 0 }
  },
  lastRunId: { type: String, default: null, index: true },
  pipelineVersion: { type: String, required: true }
}, {
  timestamps: true,
  minimize: false
});

emailSchema.index({ lastRunId: 1, processingState: 1 });

export const Email = mongoose.models.Email ?? mongoose.model('Email', emailSchema);
export default Email;
