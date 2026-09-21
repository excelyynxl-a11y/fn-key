import { COMPARISON_FIELDS } from '../constants/challenge.js';
import { submissionRowSchema, submissionSchema } from '../schemas/submissionSchema.js';

function readValue(record, camelCase, snakeCase) {
  return record[camelCase] ?? record[snakeCase];
}

export function createSubmissionRow(result) {
  const defectFields = readValue(result, 'defectFields', 'defect_fields') ?? [];
  const orderedDefectFields = COMPARISON_FIELDS.filter((field) => defectFields.includes(field));
  const row = {
    category: result.category,
    status: result.status,
    review_reason: readValue(result, 'reviewReason', 'review_reason') ?? null,
    has_defect: readValue(result, 'hasDefect', 'has_defect') ?? false,
    defect_fields: orderedDefectFields
  };

  const fieldDetails = readValue(result, 'fieldDetails', 'field_details');
  if (row.status === 'MISMATCH' && fieldDetails) {
    row.field_details = Object.fromEntries(
      orderedDefectFields.map((field) => [
        field,
        fieldDetails instanceof Map ? fieldDetails.get(field) : fieldDetails[field]
      ])
    );
  }

  return submissionRowSchema.parse(row);
}

export function buildSubmission(records, expectedEmailIds) {
  const expectedIds = [...new Set(expectedEmailIds)].sort();
  if (expectedIds.length !== expectedEmailIds.length) {
    throw new Error('Expected email IDs contain duplicates');
  }

  const byId = new Map();
  for (const record of records) {
    const emailId = record.emailId ?? record.email_id;
    if (!emailId) throw new Error('A result is missing emailId');
    if (byId.has(emailId)) throw new Error(`Duplicate result for ${emailId}`);
    byId.set(emailId, record);
  }

  const actualIds = [...byId.keys()].sort();
  const missing = expectedIds.filter((emailId) => !byId.has(emailId));
  const unexpected = actualIds.filter((emailId) => !expectedIds.includes(emailId));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(`Submission ID mismatch; missing=${missing.join(',') || 'none'}; unexpected=${unexpected.join(',') || 'none'}`);
  }

  const submission = Object.fromEntries(
    expectedIds.map((emailId) => [emailId, createSubmissionRow(byId.get(emailId))])
  );
  return submissionSchema.parse(submission);
}

export function validateSubmissionArtifact(submission, expectedEmailIds) {
  const parsed = submissionSchema.parse(submission);
  const expected = [...new Set(expectedEmailIds)].sort();
  if (expected.length !== expectedEmailIds.length) throw new Error('Expected email IDs contain duplicates');
  const actual = Object.keys(parsed).sort();
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((emailId) => !actualSet.has(emailId));
  const unexpected = actual.filter((emailId) => !expectedSet.has(emailId));
  if (missing.length || unexpected.length) {
    throw new Error(`Submission ID mismatch; missing=${missing.join(',') || 'none'}; unexpected=${unexpected.join(',') || 'none'}`);
  }
  return { valid: true, expectedCount: expected.length, actualCount: actual.length, errors: [] };
}
