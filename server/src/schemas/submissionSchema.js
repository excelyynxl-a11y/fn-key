import { z } from 'zod';
import {
  COMPARISON_FIELDS,
  COMPARISON_STATUSES,
  EMAIL_CATEGORIES,
  REVIEW_REASONS
} from '../constants/challenge.js';

const fieldNameSchema = z.enum(COMPARISON_FIELDS);
const fieldDetailSchema = z.object({
  SI: z.string(),
  BL: z.string()
}).strict();

export const submissionRowSchema = z.object({
  category: z.enum(EMAIL_CATEGORIES),
  status: z.enum(COMPARISON_STATUSES),
  review_reason: z.enum(REVIEW_REASONS).nullable(),
  has_defect: z.boolean(),
  defect_fields: z.array(fieldNameSchema),
  field_details: z.partialRecord(fieldNameSchema, fieldDetailSchema).optional()
}).strict().superRefine((row, context) => {
  const uniqueFields = new Set(row.defect_fields);
  if (uniqueFields.size !== row.defect_fields.length) {
    context.addIssue({
      code: 'custom',
      path: ['defect_fields'],
      message: 'defect_fields must not contain duplicates'
    });
  }

  if (row.status === 'OK') {
    if (row.review_reason !== null || row.has_defect || row.defect_fields.length > 0 || row.field_details) {
      context.addIssue({
        code: 'custom',
        message: 'OK rows cannot contain review or defect information'
      });
    }
  }

  if (row.status === 'NEEDS_REVIEW') {
    if (!row.review_reason || row.has_defect || row.defect_fields.length > 0 || row.field_details) {
      context.addIssue({
        code: 'custom',
        message: 'NEEDS_REVIEW rows require a reason and cannot contain defects'
      });
    }
  }

  if (row.status === 'MISMATCH') {
    if (row.review_reason !== null || !row.has_defect || row.defect_fields.length === 0 || !row.field_details) {
      context.addIssue({
        code: 'custom',
        message: 'MISMATCH rows require defect fields and matching field details'
      });
      return;
    }

    const detailFields = Object.keys(row.field_details);
    const missingDetails = row.defect_fields.filter((field) => !detailFields.includes(field));
    const extraDetails = detailFields.filter((field) => !uniqueFields.has(field));
    if (missingDetails.length > 0 || extraDetails.length > 0) {
      context.addIssue({
        code: 'custom',
        path: ['field_details'],
        message: 'field_details keys must exactly match defect_fields'
      });
    }
  }
});

export const submissionSchema = z.record(z.string(), submissionRowSchema);
