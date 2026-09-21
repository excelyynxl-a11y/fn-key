import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';

async function withServer(callback, options) {
  const server = createApp(options).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const address = server.address();
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('serves the API identity envelope', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.service, 'sdoc-api');
    assert.equal(body.error, null);
    assert.match(body.meta.requestId, /^[0-9a-f-]{36}$/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  });
});

test('preserves a safe caller request ID in response envelopes', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`, { headers: { 'x-request-id': 'demo-request-42' } });
    assert.equal(response.headers.get('x-request-id'), 'demo-request-42');
    assert.equal((await response.json()).meta.requestId, 'demo-request-42');
  });
});

test('rejects browser origins outside the configured allowlist', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`, { headers: { origin: 'https://untrusted.example' } });
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.error.code, 'CORS_DENIED');
    assert.ok(body.meta.requestId);
  });
});

test('rate limits API traffic with retry guidance', async () => {
  await withServer(async (baseUrl) => {
    await fetch(`${baseUrl}/api/unknown`);
    const response = await fetch(`${baseUrl}/api/unknown`);
    assert.equal(response.status, 429);
    const body = await response.json();
    assert.equal(body.error.code, 'RATE_LIMITED');
    assert.equal(body.error.retryable, true);
    assert.ok(Number(response.headers.get('retry-after')) >= 1);
  }, { rateLimitMaximum: 1, rateLimitWindowMs: 60_000 });
});

test('reports unavailable while MongoDB is disconnected', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 503);
  });
});

test('returns a consistent not-found envelope', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/does-not-exist`);
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.error.code, 'NOT_FOUND');
  });
});
