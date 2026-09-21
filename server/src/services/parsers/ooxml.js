import JSZip from 'jszip';
import { parserError } from './parserError.js';

export const OOXML_LIMITS = Object.freeze({
  maximumEntries: 2_000,
  maximumXmlBytes: 25 * 1024 * 1024,
  maximumTotalXmlBytes: 50 * 1024 * 1024
});

export function decodeXml(value) {
  return String(value ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_match, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function attributesFromTag(tag) {
  return Object.fromEntries([...String(tag).matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gs)]
    .map((match) => [match[1], decodeXml(match[3])]));
}

export function textNodes(xml, localName = 't') {
  const expression = new RegExp(`<\\w*:?${localName}\\b[^>]*>([\\s\\S]*?)<\\/\\w*:?${localName}>`, 'gi');
  return [...String(xml).matchAll(expression)]
    .map((match) => decodeXml(match[1].replace(/<[^>]+>/g, '')));
}

export async function loadOoxml(buffer, limits = OOXML_LIMITS) {
  let zip;
  try {
    // Decompress only the entries each parser actually needs; eager CRC checks can expand an entire hostile archive.
    zip = await JSZip.loadAsync(buffer, { checkCRC32: false });
  } catch (error) {
    const encrypted = /encrypt|password/i.test(error?.message ?? '');
    throw parserError(
      encrypted ? 'PARSER_ENCRYPTED' : 'PARSER_CORRUPT',
      encrypted ? 'Office document is encrypted' : 'Office document is not a valid ZIP package',
      { cause: error }
    );
  }

  const entries = Object.values(zip.files);
  if (entries.length > limits.maximumEntries) {
    throw parserError('PARSER_LIMIT_EXCEEDED', `Office document contains more than ${limits.maximumEntries} package entries`);
  }
  return zip;
}

export async function readXmlEntry(zip, entryName, {
  required = true,
  maximumBytes = OOXML_LIMITS.maximumXmlBytes,
  expansionBudget = null
} = {}) {
  const entry = zip.file(entryName);
  if (!entry) {
    if (!required) return null;
    throw parserError('PARSER_CORRUPT', `Office document is missing ${entryName}`);
  }
  const xml = await entry.async('string');
  const xmlBytes = Buffer.byteLength(xml, 'utf8');
  if (xmlBytes > maximumBytes) {
    throw parserError('PARSER_LIMIT_EXCEEDED', `${entryName} exceeds the XML expansion limit`);
  }
  if (expansionBudget) {
    expansionBudget.usedBytes += xmlBytes;
    if (expansionBudget.usedBytes > expansionBudget.maximumBytes) {
      throw parserError('PARSER_LIMIT_EXCEEDED', 'Office document exceeds the total XML expansion limit');
    }
  }
  return xml;
}

export function commonParserResult({
  format,
  mimeType,
  text,
  lines,
  blocks,
  cells = [],
  warnings = [],
  readabilityScore = 1,
  metadata = {}
}) {
  const readable = text.trim().length > 0 && readabilityScore > 0;
  return {
    format,
    mimeType,
    text,
    lines,
    blocks,
    cells,
    warnings,
    readable,
    readabilityScore,
    scanned: false,
    metadata
  };
}
