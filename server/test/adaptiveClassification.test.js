import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyEmail } from '../src/services/adaptiveClassificationService.js';

test('returns deterministic decisions without calling AI', async () => {
  let aiCalls = 0;
  const decision = await classifyEmail({
    emailId: 'email_001',
    subject: 'TO CONFIRM DOCS',
    body: 'Attached are the SI and draft BL. Please check the details and confirm.'
  }, {
    aiClassifier: async () => { aiCalls += 1; }
  });

  assert.equal(decision.category, 'BL_COMPARISON');
  assert.equal(decision.method, 'rule');
  assert.equal(aiCalls, 0);
});

test('uses AI for uncertain messages and passes evidence into guarded learning', async () => {
  const learned = [];
  const decision = await classifyEmail({
    emailId: 'email_900',
    subject: 'Quick question',
    body: 'Could you check the revised sailing schedule?'
  }, {
    aiClassifier: async () => ({
      category: 'GENERAL',
      reason: 'Routine operational request',
      evidencePhrases: ['revised sailing schedule'],
      confidence: 0.86,
      cacheHit: false,
      responseId: 'resp_1',
      attempts: 1,
      usage: { input_tokens: 42 }
    }),
    phraseLearner: async (input) => learned.push(input),
    model: 'test-model'
  });

  assert.equal(decision.category, 'GENERAL');
  assert.equal(decision.method, 'ai');
  assert.equal(decision.model, 'test-model');
  assert.equal(decision.matchedEvidence[0].location, 'body');
  assert.equal(learned[0].email.emailId, 'email_900');
});
