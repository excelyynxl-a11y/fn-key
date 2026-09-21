import path from 'node:path';
import { parseDocxBuffer } from './parsers/docxParser.js';
import { parsePdfBuffer } from './parsers/pdfParser.js';
import { parserError } from './parsers/parserError.js';
import { parseTextBuffer } from './parsers/textParser.js';
import { parseXlsxBuffer } from './parsers/xlsxParser.js';

const MAXIMUM_FILE_BYTES = 10 * 1024 * 1024;

const FORMAT_MIME_TYPES = Object.freeze({
  txt: 'text/plain',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
});

function detectedZipFormat(buffer) {
  const packageNames = buffer.toString('latin1');
  if (packageNames.includes('word/document.xml')) return 'docx';
  if (packageNames.includes('xl/workbook.xml')) return 'xlsx';
  return 'zip';
}

export function detectFileFormat(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return 'empty';
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'pdf';
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2])) {
    return detectedZipFormat(buffer);
  }
  const sample = buffer.subarray(0, Math.min(buffer.length, 4_096));
  const nullBytes = [...sample].filter((byte) => byte === 0).length;
  return nullBytes / sample.length < 0.01 ? 'txt' : 'unknown';
}

export async function parseAttachment(buffer, attachment = {}) {
  if (!Buffer.isBuffer(buffer)) throw parserError('PARSER_UNREADABLE', 'Attachment data must be a Buffer');
  if (buffer.length === 0) throw parserError('PARSER_EMPTY', 'Attachment is empty');
  if (buffer.length > MAXIMUM_FILE_BYTES) {
    throw parserError('PARSER_LIMIT_EXCEEDED', `Attachment exceeds the ${MAXIMUM_FILE_BYTES} byte limit`);
  }

  const format = detectFileFormat(buffer);
  if (['zip', 'unknown'].includes(format)) {
    throw parserError('PARSER_UNSUPPORTED', 'Attachment signature is not a supported document format');
  }
  const extension = String(attachment.extension ?? path.extname(attachment.filename ?? attachment.reference ?? ''))
    .toLowerCase()
    .replace(/^\./, '');
  const warnings = extension && extension !== format
    ? [`File extension .${extension} does not match detected ${format} content`]
    : [];

  const parser = {
    txt: parseTextBuffer,
    pdf: parsePdfBuffer,
    docx: parseDocxBuffer,
    xlsx: parseXlsxBuffer
  }[format];
  const result = await parser(buffer);
  return {
    ...result,
    mimeType: FORMAT_MIME_TYPES[format],
    warnings: [...warnings, ...(result.warnings ?? [])]
  };
}

export function parseTextFile(file) {
  return parseTextBuffer(file.buffer).text;
}
