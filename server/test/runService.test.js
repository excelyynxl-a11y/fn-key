import assert from 'node:assert/strict';
import test from 'node:test';
import { runWithConcurrency } from '../src/services/runService.js';

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
