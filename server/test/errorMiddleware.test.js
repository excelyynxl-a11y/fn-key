import assert from 'node:assert/strict';
import test from 'node:test';
import { errorHandler } from '../src/middleware/errorMiddleware.js';

function responseRecorder() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('preserves an explicit retryable conflict for stale review clients', () => {
  const response = responseRecorder();
  const error = Object.assign(new Error('Review changed since it was loaded'), {
    code: 'REVIEW_CONFLICT', statusCode: 409, retryable: true
  });
  errorHandler(error, {}, response, () => {});
  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.body.error, {
    code: 'REVIEW_CONFLICT',
    message: 'Review changed since it was loaded',
    retryable: true
  });
});
