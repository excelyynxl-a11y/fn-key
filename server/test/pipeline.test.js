import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createDatasetRepository } from '../src/repositories/datasetRepository.js';
import { normalizeGrossWeightKg } from '../src/services/normalizationService.js';
import { processEmail } from '../src/services/pipelineService.js';

const datasetPath = path.resolve(process.cwd(), '..', 'sdoc-hackathon-bundle');
const repository = createDatasetRepository(datasetPath);

async function loadEmail(emailId) {
  const source = (await repository.listEmails()).find((email) => email.email_id === emailId);
  const attachments = await Promise.all(
    source.attachments.map((reference) => repository.inspectAttachment(reference))
  );
  return { ...source, attachments };
}

test('processes a matching plain-text SI and BL end to end', async () => {
  const email = await loadEmail('email_001');
  const processed = await processEmail(email, repository);

  assert.equal(processed.classification.category, 'BL_COMPARISON');
  assert.equal(processed.result.status, 'OK');
  assert.equal(Object.keys(processed.documents.si.fields).length, 7);
  assert.equal(processed.documents.si.fields.gross_weight_kg.normalizedValue, 21577);
});

test('finds the expected mismatches in email_004', async () => {
  const email = await loadEmail('email_004');
  const processed = await processEmail(email, repository);

  assert.equal(processed.result.status, 'MISMATCH');
  assert.deepEqual(processed.result.defectFields, ['consignee', 'notify_party']);
  assert.deepEqual(processed.result.fieldDetails.consignee, {
    SI: 'EAST BRIGHT FZ-LLC',
    BL: 'UAB NOVAKOPA'
  });
});

test('normalizes equivalent gross-weight formats', () => {
  assert.equal(normalizeGrossWeightKg('22 MT'), 22000);
  assert.equal(normalizeGrossWeightKg('22,000 KG'), 22000);
  assert.equal(normalizeGrossWeightKg('22000kg'), 22000);
});
