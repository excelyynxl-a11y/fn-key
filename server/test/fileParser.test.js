import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { detectFileFormat, parseAttachment } from '../src/services/fileParserService.js';

const attachmentPath = path.resolve(process.cwd(), '..', 'shipmail-hackathon-bundle', 'attachments');

async function parseFixture(filename) {
  const buffer = await readFile(path.join(attachmentPath, filename));
  return parseAttachment(buffer, { filename });
}

test('parses TXT, PDF, DOCX, and XLSX into one evidence contract', async () => {
  const [text, pdf, docx, xlsx] = await Promise.all([
    parseFixture('email_001_SI.txt'),
    parseFixture('email_059_SI.pdf'),
    parseFixture('email_055_BL.docx'),
    parseFixture('email_055_SI.xlsx')
  ]);

  assert.equal(text.format, 'txt');
  assert.equal(text.lines[3].location.line, 4);
  assert.match(text.text, /Shipper\/Exporter:/);

  assert.equal(pdf.format, 'pdf');
  assert.equal(pdf.metadata.pageCount, 1);
  assert.equal(pdf.lines.every(({ location }) => location.page === 1), true);
  assert.match(pdf.text, /BILL OF LADING INSTRUCTION/);

  assert.equal(docx.format, 'docx');
  assert.ok(docx.cells.some(({ text: value, location }) => (
    value.includes('APRIL FINE PAPER TRADING') && location.cell === 'T1R1C2'
  )));

  assert.equal(xlsx.format, 'xlsx');
  assert.deepEqual(xlsx.metadata.sheets, ['S.I.']);
  assert.ok(xlsx.cells.some(({ text: value, location }) => value === 'SINGAPORE' && location.cell === 'B7'));
});

test('distinguishes scanned and structurally invalid PDFs', async () => {
  const scanned = await parseFixture('email_512_SI.pdf');
  assert.equal(scanned.readable, false);
  assert.equal(scanned.scanned, true);
  assert.match(scanned.warnings[0], /scanned/);

  await assert.rejects(
    parseFixture('email_511_BL.pdf'),
    (error) => error.code === 'PARSER_CORRUPT'
  );
});

test('uses file signatures and reports extension mismatches', async () => {
  const buffer = await readFile(path.join(attachmentPath, 'email_059_SI.pdf'));
  assert.equal(detectFileFormat(buffer), 'pdf');
  const parsed = await parseAttachment(buffer, { filename: 'misleading.txt' });
  assert.match(parsed.warnings[0], /does not match/);
});

test('distinguishes empty and unsupported binary inputs', async () => {
  await assert.rejects(
    parseAttachment(Buffer.alloc(0), { filename: 'empty.txt' }),
    (error) => error.code === 'PARSER_EMPTY'
  );
  await assert.rejects(
    parseAttachment(Buffer.from([0, 1, 2, 3, 4, 5]), { filename: 'unknown.bin' }),
    (error) => error.code === 'PARSER_UNSUPPORTED'
  );
});
