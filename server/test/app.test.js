import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';

async function withServer(callback) {
  const server = createApp().listen(0, '127.0.0.1');
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
  });
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
