import { z } from 'zod';
import { COMPARISON_FIELDS, EMAIL_CATEGORIES, REVIEW_REASONS } from '../constants/challenge.js';
import AuditEvent from '../models/AuditEvent.js';
import Email from '../models/Email.js';
import ReviewCase from '../models/ReviewCase.js';
import { reopenReview, resolveReview, retryReviewedEmail } from '../services/reviewService.js';

const listReviewSchema = z.object({
  runId: z.string().min(1),
  status: z.enum(['open', 'resolved']).optional(),
  reviewReason: z.enum(REVIEW_REASONS).optional(),
  stage: z.enum(['attachment', 'readability', 'document_role', 'field']).optional(),
  emailId: z.string().optional()
});

const correctionsSchema = z.object({
  category: z.enum(EMAIL_CATEGORIES).optional(),
  roles: z.object({
    siAttachmentReference: z.string().min(1),
    blAttachmentReference: z.string().min(1)
  }).strict().optional(),
  fields: z.array(z.object({
    documentType: z.enum(['SI', 'BL']),
    field: z.enum(COMPARISON_FIELDS),
    rawValue: z.string().trim().min(1).max(2_000)
  }).strict()).max(COMPARISON_FIELDS.length * 2).optional()
}).strict();

const resolveReviewSchema = z.object({
  action: z.enum(['confirm', 'correct']),
  preview: z.boolean().default(false),
  expectedVersion: z.number().int().min(0),
  note: z.string().trim().min(3).max(2_000),
  reviewer: z.string().trim().min(1).max(200).default('operations-reviewer'),
  corrections: correctionsSchema.optional(),
  knowledgeUpdate: z.object({
    enabled: z.boolean(),
    phrase: z.string().trim().min(2).max(120).optional()
  }).strict().optional()
}).strict().superRefine((value, context) => {
  if (value.action !== 'correct') return;
  const corrections = value.corrections;
  if (!corrections || (!corrections.category && !corrections.roles && !corrections.fields?.length)) {
    context.addIssue({ code: 'custom', path: ['corrections'], message: 'A correction is required' });
  }
  if (value.knowledgeUpdate?.enabled && !value.knowledgeUpdate.phrase) {
    context.addIssue({ code: 'custom', path: ['knowledgeUpdate', 'phrase'], message: 'A phrase is required for a knowledge update' });
  }
});

const reopenReviewSchema = z.object({
  expectedVersion: z.number().int().min(0),
  reason: z.string().trim().min(3).max(2_000),
  reviewer: z.string().trim().min(1).max(200).default('operations-reviewer')
}).strict();

const retrySchema = z.object({ runId: z.string().min(1) }).strict();

export async function listReviewsController(req, res) {
  const input = listReviewSchema.parse(req.query);
  const filter = { runId: input.runId };
  for (const key of ['status', 'reviewReason', 'stage', 'emailId']) if (input[key]) filter[key] = input[key];
  const reviews = await ReviewCase.find(filter).sort({ reviewReason: 1, emailId: 1 }).lean();
  const grouped = reviews.reduce((counts, review) => ({
    ...counts, [review.reviewReason]: (counts[review.reviewReason] ?? 0) + 1
  }), {});
  res.json({ data: reviews, error: null, meta: { total: reviews.length, grouped } });
}

export async function getReviewController(req, res) {
  const review = await ReviewCase.findOne({ reviewId: req.params.reviewId }).lean();
  if (!review) return res.status(404).json({ data: null, error: { code: 'REVIEW_NOT_FOUND', message: 'Review not found', retryable: false }, meta: {} });
  const [email, timeline] = await Promise.all([
    Email.findOne({ emailId: review.emailId, lastRunId: review.runId }).lean({ flattenMaps: true }),
    AuditEvent.find({ emailId: review.emailId }).sort({ createdAt: 1 }).lean()
  ]);
  return res.json({ data: { review, email, timeline }, error: null, meta: {} });
}

export async function resolveReviewController(req, res) {
  const input = resolveReviewSchema.parse(req.body);
  const outcome = await resolveReview(req.params.reviewId, input);
  if (!outcome) return res.status(404).json({ data: null, error: { code: 'REVIEW_NOT_FOUND', message: 'Review not found', retryable: false }, meta: {} });
  return res.json({ data: outcome, error: null, meta: { preview: input.preview } });
}

export async function reopenReviewController(req, res) {
  const input = reopenReviewSchema.parse(req.body);
  const review = await reopenReview(req.params.reviewId, input);
  if (!review) return res.status(404).json({ data: null, error: { code: 'REVIEW_NOT_FOUND', message: 'Review not found', retryable: false }, meta: {} });
  return res.json({ data: review, error: null, meta: {} });
}

export async function retryEmailController(req, res) {
  const { runId } = retrySchema.parse(req.body);
  const processed = await retryReviewedEmail(req.params.emailId, runId);
  if (!processed) return res.status(404).json({ data: null, error: { code: 'EMAIL_NOT_FOUND', message: 'Email not found', retryable: false }, meta: {} });
  return res.json({ data: processed, error: null, meta: {} });
}
