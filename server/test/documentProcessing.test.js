import assert from 'node:assert/strict';
import test from 'node:test';
import { identifyDocumentRoles } from '../src/services/documentTypeService.js';
import {
  normalizeContainerCount,
  normalizeGrossWeightKg,
  normalizeParty,
  normalizePort
} from '../src/services/normalizationService.js';

test('identifies attachment roles from filename and parsed content evidence', () => {
  const roles = identifyDocumentRoles([
    {
      reference: 'attachments/unknown-a.txt',
      filename: 'unknown-a.txt',
      parsedDocument: { text: 'BILL OF LADING INSTRUCTION\nShipper: Example' }
    },
    {
      reference: 'attachments/unknown-b.txt',
      filename: 'unknown-b.txt',
      parsedDocument: { text: 'BILL OF LADING (DRAFT)\nShipper: Example' }
    }
  ]);

  assert.equal(roles.valid, true);
  assert.equal(roles.si.reference, 'attachments/unknown-a.txt');
  assert.equal(roles.bl.reference, 'attachments/unknown-b.txt');
  assert.ok(roles.si.roleEvidence.some(({ source }) => source === 'content'));
});

test('keeps ambiguous document roles unresolved', () => {
  const roles = identifyDocumentRoles([
    { reference: 'attachments/a.txt', parsedDocument: { text: 'Shipment details' } },
    { reference: 'attachments/b.txt', parsedDocument: { text: 'Shipment details' } }
  ]);
  assert.equal(roles.valid, false);
  assert.equal(roles.ambiguous, true);
});

test('uses content to recover swapped filenames and rejects duplicate roles', () => {
  const swapped = identifyDocumentRoles([
    {
      reference: 'attachments/shipment_BL.txt',
      filename: 'shipment_BL.txt',
      parsedDocument: { text: 'BILL OF LADING INSTRUCTION\nShipper: Example' }
    },
    {
      reference: 'attachments/shipment_SI.txt',
      filename: 'shipment_SI.txt',
      parsedDocument: { text: 'BILL OF LADING (DRAFT)\nShipper: Example' }
    }
  ]);
  assert.equal(swapped.valid, true);
  assert.equal(swapped.si.reference, 'attachments/shipment_BL.txt');
  assert.equal(swapped.bl.reference, 'attachments/shipment_SI.txt');

  const duplicate = identifyDocumentRoles([
    { reference: 'attachments/one_BL.txt', parsedDocument: { text: 'BILL OF LADING (DRAFT)' } },
    { reference: 'attachments/two_BL.txt', parsedDocument: { text: 'BILL OF LADING (DRAFT)' } }
  ]);
  assert.equal(duplicate.valid, false);
});

test('does not treat a negated role phrase in a wrong document as a valid header', () => {
  const roles = identifyDocumentRoles([
    {
      reference: 'attachments/email_501_SI.txt',
      filename: 'email_501_SI.txt',
      parsedDocument: { text: 'SHIPPING INSTRUCTION\nShipper: Example' }
    },
    {
      reference: 'attachments/email_501_BL.txt',
      filename: 'email_501_BL.txt',
      parsedDocument: { text: 'COMMERCIAL INVOICE\nInvoice No: 42\nNOT A SHIPPING INSTRUCTION' }
    }
  ]);
  assert.equal(roles.valid, false);
  assert.equal(roles.wrongTypeDetected, true);
});

test('normalizes only explicit port codes and conservatively parses quantities', () => {
  assert.equal(normalizeParty('  Ａcme Paper, Ltd.  '), 'ACME PAPER LTD');
  assert.equal(normalizeParty('???'), null);
  assert.equal(normalizePort('PORT KLANG (WESTPORT), MALAYSIA (MYPKG)'), 'MYPKG');
  assert.equal(normalizePort('PORT KLANG (WESTPORT), MALAYSIA'), 'PORT KLANG WESTPORT MALAYSIA');
  assert.equal(normalizePort('NHAVA SHEVA, INDIA'), 'INNSA');
  assert.equal(normalizePort('N/A'), null);
  assert.equal(normalizeContainerCount("2 x 20'GP + 3 x 40'HC"), 5);
  assert.equal(normalizeContainerCount('0 containers'), 0);
  assert.equal(normalizeContainerCount('containers pending'), null);
  assert.equal(normalizeGrossWeightKg('1.25 MT'), 1250);
  assert.equal(normalizeGrossWeightKg('0 KG'), 0);
  assert.equal(normalizeGrossWeightKg('-1 KG'), null);
  assert.equal(normalizeGrossWeightKg('22 elephants'), null);
});
