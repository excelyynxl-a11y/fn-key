import { z } from 'zod';
import { COMPARISON_FIELDS, EMAIL_CATEGORIES } from '../constants/challenge.js';

export const aiEmailClassificationSchema = z.object({
  category: z.enum(EMAIL_CATEGORIES),
  reason: z.string().trim().min(1).max(400),
  evidencePhrases: z.array(z.string().trim().min(2).max(200)).min(1).max(5),
  confidence: z.number().min(0).max(1)
}).strict();

export const aiDocumentRoleSchema = z.object({
  documents: z.array(z.object({
    attachmentReference: z.string().trim().min(1).max(500),
    role: z.enum(['SI', 'BL', 'UNKNOWN']),
    evidence: z.string().trim().min(1).max(500),
    confidence: z.number().min(0).max(1)
  }).strict()).min(1).max(10)
}).strict();

const nullableText = z.string().trim().max(2_000).nullable();

export const aiDocumentFieldSchema = z.object({
  fields: z.array(z.object({
    field: z.enum(COMPARISON_FIELDS),
    missing: z.boolean(),
    rawValue: nullableText,
    sourceLabel: nullableText,
    evidence: nullableText,
    location: z.object({
      page: z.number().int().positive().nullable(),
      sheet: nullableText,
      cell: nullableText,
      line: z.number().int().positive().nullable()
    }).strict(),
    confidence: z.number().min(0).max(1)
  }).strict()).min(1).max(COMPARISON_FIELDS.length)
}).strict();
