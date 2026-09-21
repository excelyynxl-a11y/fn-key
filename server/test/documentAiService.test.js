import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectDocumentRolesWithAi,
  documentAiCacheKey,
  extractDocumentFieldsWithAi
} from '../src/services/documentAiService.js';

function query(value) {
  return { async lean() { return value; } };
}

function emptyCache(writes = []) {
  return {
    findOne: () => query(null),
    async updateOne(filter, update, options) { writes.push({ filter, update, options }); }
  };
}

const config = { maximumAiAttempts: 1, aiTimeoutMs: 5_000 };

test('uses structured AI only to resolve ambiguous attachment roles', async () => {
  const attachments = [
    { reference: 'attachments/a.txt', parsedDocument: { text: 'SHIPPING INSTRUCTION\nShipper: ACME' } },
    { reference: 'attachments/b.txt', parsedDocument: { text: 'DRAFT BILL OF LADING\nShipper: ACME' } }
  ];
  const writes = [];
  const client = { responses: { async parse(request) {
    assert.equal(request.store, false);
    assert.ok(request.text.format);
    return {
      id: 'resp_roles',
      status: 'completed',
      output_parsed: { documents: [
        { attachmentReference: 'attachments/a.txt', role: 'SI', evidence: 'SHIPPING INSTRUCTION', confidence: 0.94 },
        { attachmentReference: 'attachments/b.txt', role: 'BL', evidence: 'DRAFT BILL OF LADING', confidence: 0.95 }
      ] }
    };
  } } };

  const roles = await detectDocumentRolesWithAi(attachments, {
    client, cacheModel: emptyCache(writes), model: 'test-model', config
  });
  assert.equal(roles.valid, true);
  assert.equal(roles.si.roleMethod, 'ai');
  assert.equal(writes[0].options.upsert, true);
  assert.equal(writes[0].update.$setOnInsert.purpose, 'document_roles');
  assert.equal(writes[0].update.$setOnInsert.schemaVersion, 'document-ai-v1');
});

test('keeps low-confidence AI role guesses unresolved', async () => {
  const attachments = [
    { reference: 'attachments/a.txt', parsedDocument: { text: 'Shipping data A' } },
    { reference: 'attachments/b.txt', parsedDocument: { text: 'Shipping data B' } }
  ];
  const client = { responses: { async parse() {
    return {
      status: 'completed',
      output_parsed: { documents: [
        { attachmentReference: 'attachments/a.txt', role: 'SI', evidence: 'Shipping data A', confidence: 0.6 },
        { attachmentReference: 'attachments/b.txt', role: 'BL', evidence: 'Shipping data B', confidence: 0.95 }
      ] }
    };
  } } };
  const roles = await detectDocumentRolesWithAi(attachments, {
    client, cacheModel: emptyCache(), model: 'test-model', config
  });
  assert.equal(roles.valid, false);
  assert.equal(roles.ambiguous, true);
});

test('extracts only requested missing fields and validates verbatim evidence', async () => {
  const attachment = {
    reference: 'attachments/a.txt',
    parsedDocument: {
      text: 'Shipper: ACME PAPER LTD',
      mimeType: 'text/plain',
      scanned: false,
      lines: [{
        text: 'Shipper: ACME PAPER LTD',
        location: { page: null, sheet: null, cell: null, line: 7 }
      }]
    }
  };
  const client = { responses: { async parse() {
    return {
      id: 'resp_fields',
      status: 'completed',
      output_parsed: { fields: [{
        field: 'shipper',
        missing: false,
        rawValue: 'ACME PAPER LTD',
        sourceLabel: 'Shipper',
        evidence: 'Shipper: ACME PAPER LTD',
        location: { page: null, sheet: null, cell: null, line: 1 },
        confidence: 0.92
      }] }
    };
  } } };

  const result = await extractDocumentFieldsWithAi(attachment, ['shipper'], {
    client, cacheModel: emptyCache(), model: 'test-model', config
  });
  assert.equal(result.fields.shipper.normalizedValue, 'ACME PAPER LTD');
  assert.equal(result.fields.shipper.method, 'ai');
  assert.equal(result.fields.shipper.evidenceVerified, true);
  assert.equal(result.fields.shipper.location.line, 7);
});

test('rejects an unrequested field and uses a vision file input for scanned PDFs', async () => {
  const attachment = {
    reference: 'attachments/scanned.pdf',
    filename: 'scanned.pdf',
    buffer: Buffer.from('%PDF scanned fixture'),
    parsedDocument: { text: '', mimeType: 'application/pdf', scanned: true }
  };
  let requestInput;
  const client = { responses: { async parse(request) {
    requestInput = request.input;
    return {
      id: 'resp_scan',
      status: 'completed',
      output_parsed: { fields: [{
        field: 'shipper',
        missing: false,
        rawValue: 'ACME',
        sourceLabel: 'Shipper',
        evidence: 'Shipper: ACME',
        location: { page: 1, sheet: null, cell: null, line: null },
        confidence: 0.9
      }] }
    };
  } } };
  const result = await extractDocumentFieldsWithAi(attachment, ['shipper'], {
    client, cacheModel: emptyCache(), model: 'test-model', config
  });
  assert.equal(requestInput[0].content[1].type, 'input_file');
  assert.match(requestInput[0].content[1].file_data, /^data:application\/pdf;base64,/);
  assert.equal(result.fields.shipper.evidenceVerified, false);
  assert.equal(result.fields.shipper.confidence, 0.65);
  assert.equal(result.fields.shipper.normalizedValue, null);

  const invalidClient = { responses: { async parse() {
    return {
      status: 'completed',
      output_parsed: { fields: [{
        field: 'consignee', missing: true, rawValue: null, sourceLabel: null, evidence: null,
        location: { page: null, sheet: null, cell: null, line: null }, confidence: 0
      }] }
    };
  } } };
  await assert.rejects(
    extractDocumentFieldsWithAi(attachment, ['shipper'], {
      client: invalidClient, cacheModel: emptyCache(), model: 'test-model', config
    }),
    (error) => error.code === 'AI_FIELDS_INVALID'
  );
});

test('serves identical field fallback requests from the hash cache', async () => {
  const attachment = {
    reference: 'attachments/a.txt',
    parsedDocument: { text: 'Shipper: ACME', scanned: false }
  };
  const cached = {
    result: { fields: [{
      field: 'shipper', missing: false, rawValue: 'ACME', sourceLabel: 'Shipper',
      evidence: 'Shipper: ACME', location: { page: null, sheet: null, cell: null, line: 1 }, confidence: 0.9
    }] },
    responseId: 'resp_cached',
    usage: null
  };
  let calls = 0;
  const cacheModel = { findOne: () => query(cached), async updateOne() {} };
  const result = await extractDocumentFieldsWithAi(attachment, ['shipper'], {
    client: { responses: { async parse() { calls += 1; } } },
    cacheModel,
    model: 'test-model',
    config
  });
  assert.equal(result.cacheHit, true);
  assert.equal(calls, 0);
  assert.equal(result.responseId, 'resp_cached');
  assert.equal(typeof documentAiCacheKey({
    purpose: 'document_fields', model: 'test-model', promptVersion: 'v1', sourceHash: 'hash'
  }), 'string');
});
