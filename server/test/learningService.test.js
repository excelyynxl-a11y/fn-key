import assert from 'node:assert/strict';
import test from 'node:test';
import { validateLearnedPhrase } from '../src/services/learningService.js';

const email = {
  subject: 'Please check tomorrow schedule',
  body: 'The shipment update needs an operational review. Contact team@example.com for details.'
};

test('accepts specific verbatim multi-word evidence', () => {
  assert.deepEqual(validateLearnedPhrase('operational review', email), {
    valid: true,
    normalizedPhrase: 'operational review',
    tokenCount: 2
  });
});

test('requires learned evidence to be category-specific', () => {
  assert.equal(
    validateLearnedPhrase('check tomorrow schedule', email, 'BL_COMPARISON').reason,
    'not_category_specific'
  );
  assert.equal(
    validateLearnedPhrase('operational review', email, 'GENERAL').reason,
    'not_category_specific'
  );
  assert.equal(
    validateLearnedPhrase('revised sailing schedule', { body: 'revised sailing schedule' }, 'GENERAL').valid,
    true
  );
});

test('rejects generic, invented, sensitive, and shipment-specific evidence', () => {
  assert.equal(validateLearnedPhrase('Please', email).reason, 'too_short');
  assert.equal(validateLearnedPhrase('not in the message', email).reason, 'not_verbatim');
  assert.equal(validateLearnedPhrase('team@example.com for details', email).reason, 'sensitive_or_shipment_specific');

  const shipmentEmail = { body: 'Please review booking 5RSG-00133 today.' };
  assert.equal(
    validateLearnedPhrase('booking 5RSG-00133 today', shipmentEmail).reason,
    'sensitive_or_shipment_specific'
  );
});
