import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSubmission, createSubmissionRow, validateSubmissionArtifact } from '../src/services/submissionService.js';

test('creates a schema-valid OK row', () => {
  assert.deepEqual(createSubmissionRow({
    category: 'BL_COMPARISON',
    status: 'OK',
    reviewReason: null,
    hasDefect: false,
    defectFields: []
  }), {
    category: 'BL_COMPARISON',
    status: 'OK',
    review_reason: null,
    has_defect: false,
    defect_fields: []
  });
});

test('orders mismatch fields and includes exact field details', () => {
  const row = createSubmissionRow({
    category: 'BL_COMPARISON',
    status: 'MISMATCH',
    reviewReason: null,
    hasDefect: true,
    defectFields: ['notify_party', 'consignee'],
    fieldDetails: {
      notify_party: { SI: 'EAST BRIGHT FZ-LLC', BL: 'UAB NOVAKOPA' },
      consignee: { SI: 'EAST BRIGHT FZ-LLC', BL: 'UAB NOVAKOPA' }
    }
  });

  assert.deepEqual(row.defect_fields, ['consignee', 'notify_party']);
  assert.deepEqual(Object.keys(row.field_details), ['consignee', 'notify_party']);
});

test('rejects an invalid review row', () => {
  assert.throws(() => createSubmissionRow({
    category: 'BL_COMPARISON',
    status: 'NEEDS_REVIEW',
    reviewReason: null,
    hasDefect: false,
    defectFields: []
  }));
});

test('requires exactly the expected email IDs', () => {
  const result = {
    emailId: 'email_001',
    category: 'GENERAL',
    status: 'OK',
    reviewReason: null,
    hasDefect: false,
    defectFields: []
  };

  assert.deepEqual(Object.keys(buildSubmission([result], ['email_001'])), ['email_001']);
  assert.throws(() => buildSubmission([result], ['email_001', 'email_002']), /missing=email_002/);
});

test('validates a complete submission artifact for repeatable release checks', () => {
  const row = createSubmissionRow({
    category: 'GENERAL', status: 'OK', reviewReason: null, hasDefect: false, defectFields: []
  });
  assert.deepEqual(validateSubmissionArtifact({ email_001: row }, ['email_001']), {
    valid: true, expectedCount: 1, actualCount: 1, errors: []
  });
  assert.throws(
    () => validateSubmissionArtifact({ email_002: row }, ['email_001']),
    /Submission ID mismatch/
  );
});

