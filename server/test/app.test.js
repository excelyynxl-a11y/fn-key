import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
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
    assert.equal(body.data.service, 'shipmail-api');
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

test('serves the production client and preserves API 404 responses', async () => {
  const clientDistPath = await mkdtemp(path.join(os.tmpdir(), 'shipmail-client-'));
  await writeFile(path.join(clientDistPath, 'index.html'), '<!doctype html><title>Shipmail</title><div id="root"></div>');
  try {
    await withServer(async (baseUrl) => {
      const pageResponse = await fetch(`${baseUrl}/inbox`);
      assert.equal(pageResponse.status, 200);
      assert.match(await pageResponse.text(), /<title>Shipmail<\/title>/);

      const apiResponse = await fetch(`${baseUrl}/api/unknown`);
      assert.equal(apiResponse.status, 404);
      assert.equal((await apiResponse.json()).error.code, 'NOT_FOUND');
    }, { clientDistPath });
  } finally {
    await rm(clientDistPath, { recursive: true, force: true });
  }
});
