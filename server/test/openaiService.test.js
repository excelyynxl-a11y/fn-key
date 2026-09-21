import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classificationCacheKey,
  classifyEmailWithAi,
  validateAiEvidence
} from '../src/services/openaiService.js';

const email = {
  emailId: 'email_900',
  subject: 'Question about an operational note',
  body: 'Could you review the schedule update for tomorrow?'
};

function query(value) {
  return { async lean() { return value; } };
}

test('requires AI evidence to be a verbatim email substring', () => {
  assert.throws(() => validateAiEvidence({
    category: 'GENERAL',
    reason: 'Operational update',
    evidencePhrases: ['schedule update tomorrow'],
    confidence: 0.8
  }, email), (error) => error.code === 'AI_EVIDENCE_INVALID');
});

test('returns a validated structured classification and writes a hash cache entry', async () => {
  const writes = [];
  const cacheModel = {
    findOne: () => query(null),
    async updateOne(filter, update, options) { writes.push({ filter, update, options }); }
  };
  const client = {
    responses: {
      async parse(request) {
        assert.equal(request.store, false);
        assert.ok(request.text.format);
        return {
          id: 'resp_123',
          status: 'completed',
          output_parsed: {
            category: 'GENERAL',
            reason: 'Routine schedule message',
            evidencePhrases: ['schedule update'],
            confidence: 0.84
          },
          usage: { input_tokens: 50, output_tokens: 20 }
        };
      }
    }
  };

  const result = await classifyEmailWithAi(email, { client, cacheModel, model: 'test-model' });
  assert.equal(result.category, 'GENERAL');
  assert.equal(result.cacheHit, false);
  assert.equal(writes[0].filter.cacheKey, classificationCacheKey(email, 'test-model'));
  assert.equal(writes[0].options.upsert, true);
});

test('uses cached classifications without calling the model', async () => {
  let clientCalls = 0;
  const cached = {
    result: {
      category: 'GENERAL',
      reason: 'Cached',
      evidencePhrases: ['schedule update'],
      confidence: 0.8
    },
    responseId: 'resp_cached',
    usage: null
  };
  const cacheModel = {
    findOne: () => query(cached),
    async updateOne() {}
  };
  const client = { responses: { async parse() { clientCalls += 1; } } };

  const result = await classifyEmailWithAi(email, { client, cacheModel, model: 'test-model' });
  assert.equal(result.cacheHit, true);
  assert.equal(clientCalls, 0);
});

test('retries transient model failures with bounded exponential backoff', async () => {
  let calls = 0;
  const waits = [];
  const cacheModel = { findOne: () => query(null), async updateOne() {} };
  const client = {
    responses: {
      async parse() {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error('rate limited'), { status: 429 });
        return {
          id: 'resp_retry',
          status: 'completed',
          output_parsed: {
            category: 'GENERAL',
            reason: 'Routine schedule message',
            evidencePhrases: ['schedule update'],
            confidence: 0.8
          }
        };
      }
    }
  };

  const result = await classifyEmailWithAi(email, {
    client,
    cacheModel,
    model: 'test-model',
    wait: async (milliseconds) => waits.push(milliseconds)
  });
  assert.equal(result.attempts, 2);
  assert.deepEqual(waits, [250]);
});
