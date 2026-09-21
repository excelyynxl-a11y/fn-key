import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyEmailByRules,
  scoreEmail,
  stripQuotedAndSignatureText
} from '../src/services/classificationService.js';

test('scores deterministic evidence by location and exposes every category score', () => {
  const result = classifyEmailByRules({
    subject: 'REQUEST SI for new booking',
    body: 'Please prepare shipping instruction. Best Regards, Team'
  });

  assert.equal(result.category, 'SI_REQUEST');
  assert.equal(result.method, 'rule');
  assert.ok(result.scores.SI_REQUEST > result.scores.GENERAL);
  assert.ok(result.evidencePhrases.includes('REQUEST SI'));
  assert.deepEqual(Object.keys(result.scores).sort(), [
    'BL_COMPARISON', 'GENERAL', 'INVOICE_QUERY', 'SI_REQUEST', 'SPAM'
  ]);
});

test('routes low-signal and tied messages to AI instead of enum order', () => {
  const lowSignal = classifyEmailByRules({ subject: 'Hello', body: 'Please advise.' });
  assert.equal(lowSignal.category, null);
  assert.equal(lowSignal.needsAiFallback, true);

  const phrases = [
    { target: 'SPAM', phrase: 'shared signal', weight: 5, status: 'seed', allowedLocations: ['body'] },
    { target: 'GENERAL', phrase: 'shared signal', weight: 5, status: 'seed', allowedLocations: ['body'] }
  ];
  const tied = classifyEmailByRules({ body: 'A shared signal appears.' }, phrases);
  assert.equal(tied.category, null);
  assert.equal(tied.scoreMargin, 0);
});

test('ignores signals found only in quoted or signature content', () => {
  const body = 'Current operational update.\n__________\nFrom: old@example.com\nLIMITED TIME OFFER!';
  assert.equal(stripQuotedAndSignatureText(body), 'Current operational update.');
  assert.equal(scoreEmail({ body }).scores.SPAM, 0);
});

test('probation phrases cannot dominate with seed-level weight', () => {
  const phrases = [{
    target: 'SPAM',
    phrase: 'highly suspicious phrase',
    weight: 8,
    status: 'probation',
    allowedLocations: ['body']
  }];
  const result = classifyEmailByRules({ body: 'highly suspicious phrase' }, phrases);
  assert.equal(result.category, null);
  assert.equal(result.scores.SPAM, 2.8);
});
