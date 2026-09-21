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

test('processes representative XLSX, DOCX, and PDF documents end to end', async () => {
  const expectations = [
    ['email_005', 'xlsx', 'xlsx'],
    ['email_055', 'xlsx', 'docx'],
    ['email_059', 'pdf', 'pdf']
  ];

  for (const [emailId, siFormat, blFormat] of expectations) {
    const email = await loadEmail(emailId);
    const processed = await processEmail(email, repository);
    assert.equal(processed.result.status, 'OK', emailId);
    assert.equal(processed.attachments.find(({ documentType }) => documentType === 'SI').detectedFormat, siFormat);
    assert.equal(processed.attachments.find(({ documentType }) => documentType === 'BL').detectedFormat, blFormat);
    assert.equal(Object.values(processed.documents.si.fields).every(({ rawValue }) => rawValue), true);
    assert.equal(Object.values(processed.documents.bl.fields).every(({ rawValue }) => rawValue), true);
  }
});

test('uses unreadable precedence for corrupt or scanned PDF attachments', async () => {
  for (const emailId of ['email_511', 'email_512']) {
    const email = await loadEmail(emailId);
    const processed = await processEmail(email, repository, {
      documentFieldAi: async () => {
        throw Object.assign(new Error('AI disabled for deterministic parser test'), { code: 'AI_NOT_CONFIGURED' });
      },
      phraseEntries: [{
        target: 'BL_COMPARISON',
        phrase: email.subject,
        normalizedPhrase: email.subject.toLowerCase().replace(/[_/\\|.-]+/g, ' ').replace(/\s+/g, ' ').trim(),
        tokenCount: email.subject.split(/\s+/).length,
        weight: 10,
        status: 'seed',
        allowedLocations: ['subject']
      }]
    });
    assert.equal(processed.result.status, 'NEEDS_REVIEW');
    assert.equal(processed.result.reviewReason, 'unreadable');
    assert.ok(processed.attachments.some(({ parserError }) => parserError?.code));
  }
});

test('normalizes equivalent gross-weight formats', () => {
  assert.equal(normalizeGrossWeightKg('22 MT'), 22000);
  assert.equal(normalizeGrossWeightKg('22,000 KG'), 22000);
  assert.equal(normalizeGrossWeightKg('22000kg'), 22000);
});

test('uses field AI only for unresolved values and keeps the final comparison deterministic', async () => {
  const email = await loadEmail('email_516');
  const calls = [];
  const processed = await processEmail(email, repository, {
    aiClassifier: async () => ({
      category: 'BL_COMPARISON',
      reason: 'Test fixture comparison request',
      evidencePhrases: ['Review'],
      confidence: 0.9,
      responseId: null,
      attempts: 1,
      usage: null
    }),
    phraseLearner: async () => {},
    documentFieldAi: async (attachment, requestedFields) => {
      calls.push({ reference: attachment.reference, requestedFields });
      return {
        fields: {
          gross_weight_kg: {
            rawValue: '235,550 KG',
            normalizedValue: 235550,
            sourceLabel: 'Gross Weight',
            evidence: 'Gross Weight: 235,550 KG',
            location: { page: null, sheet: null, cell: null, line: 8 },
            method: 'ai',
            confidence: 0.9,
            evidenceVerified: true,
            candidates: [],
            ambiguous: false
          }
        },
        cacheHit: false,
        attempts: 1
      };
    }
  });

  assert.equal(processed.result.status, 'OK');
  assert.deepEqual(calls, [{
    reference: 'attachments/email_516_SI.txt',
    requestedFields: ['gross_weight_kg']
  }]);
  assert.equal(processed.documents.si.fields.shipper.method, 'alias_rule');
  assert.equal(processed.documents.si.fields.gross_weight_kg.method, 'ai');
});
