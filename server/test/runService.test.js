import assert from 'node:assert/strict';
import test from 'node:test';
import { estimatedAiCost } from '../src/services/metricsService.js';
import { counterIncrement, runWithConcurrency } from '../src/services/runService.js';

test('processes every item without exceeding the concurrency limit', async () => {
  let active = 0;
  let maximumActive = 0;
  const processed = [];

  await runWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    processed.push(item);
    active -= 1;
  });

  assert.deepEqual(processed.sort((left, right) => left - right), [1, 2, 3, 4, 5]);
  assert.equal(maximumActive, 2);
});

test('updates live dashboard counters for a completed decision', () => {
  const increment = counterIncrement({
    classification: { method: 'ai', cacheHit: true },
    telemetry: {
      aiFallbacks: { classification: 1, documentRole: 0, documentFields: 2 },
      cacheHits: { classification: 1, documentRole: 0, documentFields: 1 }
    },
    result: { category: 'BL_COMPARISON', status: 'MISMATCH' }
  });
  assert.equal(increment['counts.processing'], -1);
  assert.equal(increment['counts.processed'], 1);
  assert.equal(increment['counts.aiFallbacks'], 3);
  assert.equal(increment['counts.aiCacheHits'], 2);
  assert.equal(increment['counts.mismatched'], 1);
  assert.equal(increment['counts.ok'], 0);
});

test('estimates AI cost from configurable per-million token rates', () => {
  assert.equal(estimatedAiCost({ inputTokens: 1_000_000, outputTokens: 500_000 }, {
    inputPerMillion: 2, outputPerMillion: 8
  }), 6);
});
