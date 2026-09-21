import assert from 'node:assert/strict';
import test from 'node:test';
import { estimatedAiCost } from '../src/services/metricsService.js';
import { cancelRun, counterIncrement, runWithConcurrency } from '../src/services/runService.js';

function query(value) { return { async lean() { return value; } }; }

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

test('stops scheduling new work after cooperative cancellation', async () => {
  let completed = 0;
  let stop = false;
  await runWithConcurrency([1, 2, 3, 4, 5], 1, async () => {
    completed += 1;
    stop = true;
  }, { shouldStop: () => stop });
  assert.equal(completed, 1);
});

test('cancels a queued run and records the operator request', async () => {
  let update;
  const events = [];
  const cancelled = await cancelRun('run-1', {
    runModel: {
      findOne: () => query({ runId: 'run-1', state: 'queued' }),
      findOneAndUpdate(filter, change) {
        update = { filter, change };
        return query({ runId: 'run-1', state: 'cancelled' });
      }
    },
    auditModel: { async create(event) { events.push(event); } }
  });
  assert.equal(cancelled.state, 'cancelled');
  assert.equal(update.change.$set.state, 'cancelled');
  assert.equal(events[0].eventType, 'run.cancellation_requested');
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
