import path from 'node:path';
import {
  attributesFromTag,
  commonParserResult,
  loadOoxml,
  OOXML_LIMITS,
  readXmlEntry,
  textNodes
} from './ooxml.js';
import { parserError } from './parserError.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLSX_LIMITS = Object.freeze({ maximumSheets: 20, maximumCells: 20_000 });

function sharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[\s\S]*?<\/si>/gi)].map((match) => textNodes(match[0]).join(''));
}

function cellValue(cellXml, attributes, strings) {
  if (attributes.t === 'inlineStr') return textNodes(cellXml).join('');
  const raw = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] ?? '';
  if (attributes.t === 's' && raw !== '') return strings[Number.parseInt(raw, 10)] ?? '';
  if (attributes.t === 'b') return raw === '1' ? 'TRUE' : 'FALSE';
  return raw;
}

function relationshipTargets(xml) {
  const targets = new Map();
  for (const match of xml.matchAll(/<Relationship\b[^>]*\/?\s*>/gi)) {
    const attributes = attributesFromTag(match[0]);
    if (attributes.Id && attributes.Target) targets.set(attributes.Id, attributes.Target);
  }
  return targets;
}

function workbookSheets(xml) {
  return [...xml.matchAll(/<sheet\b[^>]*\/?\s*>/gi)].map((match) => {
    const attributes = attributesFromTag(match[0]);
    return { name: attributes.name, relationshipId: attributes['r:id'] };
  }).filter(({ name, relationshipId }) => name && relationshipId);
}

function worksheetPath(target) {
  const normalized = target.replace(/\\/g, '/').replace(/^\//, '');
  return normalized.startsWith('xl/') ? normalized : path.posix.normalize(path.posix.join('xl', normalized));
}

function parseWorksheet(xml, sheetName, strings, counters) {
  const cells = [];
  const lines = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>[\s\S]*?<\/row>/gi)) {
    const rowAttributes = attributesFromTag(rowMatch[0].match(/<row\b[^>]*>/i)?.[0] ?? '');
    const rowCells = [];
    for (const cellMatch of rowMatch[0].matchAll(/<c\b[^>]*>[\s\S]*?<\/c>/gi)) {
      counters.cells += 1;
      if (counters.cells > XLSX_LIMITS.maximumCells) {
        throw parserError('PARSER_LIMIT_EXCEEDED', `Workbook contains more than ${XLSX_LIMITS.maximumCells} cells`);
      }
      const tag = cellMatch[0].match(/<c\b[^>]*>/i)?.[0] ?? '';
      const attributes = attributesFromTag(tag);
      const value = cellValue(cellMatch[0], attributes, strings).trim();
      if (!value) continue;
      const reference = attributes.r ?? null;
      const column = reference?.match(/[A-Z]+/i)?.[0]?.toUpperCase() ?? null;
      const row = Number.parseInt(reference?.match(/\d+/)?.[0] ?? rowAttributes.r ?? '', 10) || null;
      const location = {
        page: null,
        sheet: sheetName,
        cell: reference,
        line: row,
        paragraph: null,
        table: null,
        row,
        column
      };
      const block = { kind: 'cell', text: value, location };
      cells.push(block);
      rowCells.push(block);
    }
    if (rowCells.length > 0) {
      lines.push({
        line: Number.parseInt(rowAttributes.r ?? '', 10) || lines.length + 1,
        text: rowCells.map(({ text }) => text).join(' | '),
        page: null,
        sheet: sheetName,
        cell: rowCells[0].location.cell,
        location: rowCells[0].location
      });
    }
  }
  return { cells, lines };
}

export async function parseXlsxBuffer(buffer) {
  const zip = await loadOoxml(buffer);
  const expansionBudget = { usedBytes: 0, maximumBytes: OOXML_LIMITS.maximumTotalXmlBytes };
  const [workbookXml, relationshipsXml, sharedStringsXml] = await Promise.all([
    readXmlEntry(zip, 'xl/workbook.xml', { expansionBudget }),
    readXmlEntry(zip, 'xl/_rels/workbook.xml.rels', { expansionBudget }),
    readXmlEntry(zip, 'xl/sharedStrings.xml', { required: false, expansionBudget })
  ]);
  const sheets = workbookSheets(workbookXml);
  if (sheets.length > XLSX_LIMITS.maximumSheets) {
    throw parserError('PARSER_LIMIT_EXCEEDED', `Workbook contains more than ${XLSX_LIMITS.maximumSheets} sheets`);
  }
  const targets = relationshipTargets(relationshipsXml);
  const strings = sharedStrings(sharedStringsXml);
  const cells = [];
  const lines = [];
  const counters = { cells: 0 };

  for (const sheet of sheets) {
    const target = targets.get(sheet.relationshipId);
    if (!target) throw parserError('PARSER_CORRUPT', `Workbook relationship ${sheet.relationshipId} is missing`);
    const worksheetXml = await readXmlEntry(zip, worksheetPath(target), { expansionBudget });
    const parsed = parseWorksheet(worksheetXml, sheet.name, strings, counters);
    cells.push(...parsed.cells);
    lines.push(...parsed.lines);
  }

  const text = lines.map(({ sheet, line, text: lineText }) => `[${sheet}!${line}] ${lineText}`).join('\n');
  return commonParserResult({
    format: 'xlsx',
    mimeType: XLSX_MIME,
    text,
    lines,
    blocks: cells,
    cells,
    readabilityScore: text.trim() ? 1 : 0,
    metadata: { sheetCount: sheets.length, sheets: sheets.map(({ name }) => name), cellCount: cells.length }
  });
}
