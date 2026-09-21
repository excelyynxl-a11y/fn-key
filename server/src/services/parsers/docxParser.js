import { commonParserResult, loadOoxml, OOXML_LIMITS, readXmlEntry, textNodes } from './ooxml.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function paragraphText(xml) {
  const tokens = [...String(xml).matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:(?:br|cr)\b[^>]*\/?\s*>/gi)]
    .map((match) => (match[1] === undefined ? '; ' : textNodes(match[0]).join('')));
  return tokens.join('')
    .replace(/\s*;\s*/g, '; ')
    .replace(/\s+/g, ' ')
    .trim();
}

function paragraphTexts(xml) {
  return [...String(xml).matchAll(/<w:p\b[\s\S]*?<\/w:p>/gi)]
    .map((match) => paragraphText(match[0]))
    .filter(Boolean);
}

function parseTable(tableXml, tableNumber, output) {
  const rows = [...tableXml.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/gi)];
  for (const [rowIndex, rowMatch] of rows.entries()) {
    const cells = [...rowMatch[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/gi)];
    for (const [columnIndex, cellMatch] of cells.entries()) {
      const paragraphs = paragraphTexts(cellMatch[0]);
      const text = paragraphs.join('; ').trim();
      if (!text) continue;
      const cell = `T${tableNumber}R${rowIndex + 1}C${columnIndex + 1}`;
      const location = {
        page: null,
        sheet: null,
        cell,
        line: null,
        paragraph: null,
        table: tableNumber,
        row: rowIndex + 1,
        column: columnIndex + 1
      };
      const block = { kind: 'cell', text, location };
      output.blocks.push(block);
      output.cells.push(block);
    }
  }
}

function parseBodyInOrder(documentXml) {
  const body = documentXml.match(/<w:body\b[\s\S]*?<\/w:body>/i)?.[0] ?? documentXml;
  const output = { blocks: [], cells: [] };
  let offset = 0;
  let paragraphNumber = 0;
  let tableNumber = 0;

  while (offset < body.length) {
    const paragraphStart = body.indexOf('<w:p', offset);
    const tableStart = body.indexOf('<w:tbl', offset);
    if (paragraphStart < 0 && tableStart < 0) break;

    if (tableStart >= 0 && (paragraphStart < 0 || tableStart < paragraphStart)) {
      const tableEnd = body.indexOf('</w:tbl>', tableStart);
      if (tableEnd < 0) break;
      tableNumber += 1;
      parseTable(body.slice(tableStart, tableEnd + 8), tableNumber, output);
      offset = tableEnd + 8;
      continue;
    }

    const paragraphEnd = body.indexOf('</w:p>', paragraphStart);
    if (paragraphEnd < 0) break;
    paragraphNumber += 1;
    const text = paragraphText(body.slice(paragraphStart, paragraphEnd + 6));
    if (text) {
      output.blocks.push({
        kind: 'paragraph',
        text,
        location: {
          page: null,
          sheet: null,
          cell: null,
          line: paragraphNumber,
          paragraph: paragraphNumber,
          table: null,
          row: null,
          column: null
        }
      });
    }
    offset = paragraphEnd + 6;
  }
  return output;
}

export async function parseDocxBuffer(buffer) {
  const zip = await loadOoxml(buffer);
  const expansionBudget = { usedBytes: 0, maximumBytes: OOXML_LIMITS.maximumTotalXmlBytes };
  const documentXml = await readXmlEntry(zip, 'word/document.xml', { expansionBudget });
  const { blocks, cells } = parseBodyInOrder(documentXml);
  const lines = blocks.map((block, index) => ({
    line: index + 1,
    text: block.text,
    page: null,
    sheet: null,
    cell: block.location.cell,
    location: { ...block.location, line: index + 1 }
  }));
  const text = lines.map(({ text: lineText }) => lineText).join('\n');

  return commonParserResult({
    format: 'docx',
    mimeType: DOCX_MIME,
    text,
    lines,
    blocks,
    cells,
    readabilityScore: text.trim() ? 1 : 0,
    metadata: {
      paragraphCount: blocks.filter(({ kind }) => kind === 'paragraph').length,
      tableCount: Math.max(0, ...cells.map(({ location }) => location.table ?? 0)),
      cellCount: cells.length
    }
  });
}
