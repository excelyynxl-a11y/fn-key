import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createDatasetRepository, resolveInside } from '../src/repositories/datasetRepository.js';
import { importDataset } from '../src/services/inboxService.js';

const datasetPath = path.resolve(process.cwd(), '..', 'shipmail-hackathon-bundle');

test('loads and validates the complete local inbox', async () => {
  const repository = createDatasetRepository(datasetPath);
  const emails = await repository.listEmails();
  assert.equal(emails.length, 520);
  assert.equal(emails[0].email_id, 'email_001');
  assert.equal(emails.at(-1).email_id, 'email_520');
  assert.match(emails[0].sourceHash, /^[a-f0-9]{64}$/);
});

test('inspects referenced attachments and reports missing files', async () => {
  const repository = createDatasetRepository(datasetPath);
  const existing = await repository.inspectAttachment('attachments/email_001_SI.txt');
  const missing = await repository.inspectAttachment('attachments/does-not-exist.txt');

  assert.equal(existing.exists, true);
  assert.equal(existing.extension, '.txt');
  assert.ok(existing.size > 0);
  assert.equal(missing.exists, false);
});

test('blocks paths outside the dataset root', () => {
  assert.throws(() => resolveInside(datasetPath, '../secret.txt'), /escapes the dataset root/);
});

test('builds idempotent upserts for every email', async () => {
  let capturedOperations = [];
  const emailModel = {
    async bulkWrite(operations) {
      capturedOperations = operations;
    }
  };

  const result = await importDataset({
    runId: 'test-run',
    rootPath: datasetPath,
    emailModel
  });

  assert.equal(result.emailCount, 520);
  assert.equal(result.attachmentCount, 250);
  assert.equal(capturedOperations.length, 520);
  assert.equal(capturedOperations.every((operation) => operation.updateOne.upsert), true);
});
