import { z } from 'zod';
import {
  COMPARISON_FIELDS,
  EMAIL_CATEGORIES,
  REVIEW_REASONS
} from '../constants/challenge.js';

export const emailIdSchema = z.string().regex(
  /^email_[0-9]+$/,
  'email_id must use the email_### format'
);

export const sourceEmailSchema = z.object({
  email_id: emailIdSchema,
  from: z.string().min(1),
  subject: z.string(),
  body: z.string(),
  attachments: z.array(z.string().min(1))
}).strict();

export const categorySchema = z.enum(EMAIL_CATEGORIES);
export const reviewReasonSchema = z.enum(REVIEW_REASONS);
export const comparisonFieldSchema = z.enum(COMPARISON_FIELDS);

export const evidenceLocationSchema = z.object({
  page: z.number().int().positive().nullable().default(null),
  sheet: z.string().nullable().default(null),
  cell: z.string().nullable().default(null),
  line: z.number().int().positive().nullable().default(null)
}).strict();

export const extractedFieldSchema = z.object({
  rawValue: z.string().nullable(),
  normalizedValue: z.union([z.string(), z.number()]).nullable(),
  sourceLabel: z.string().nullable(),
  evidence: z.string().nullable(),
  location: evidenceLocationSchema,
  method: z.enum(['alias_rule', 'ai', 'human', 'missing']),
  confidence: z.number().min(0).max(1)
}).strict();

