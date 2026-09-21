import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parserError } from './parserError.js';

const PDF_MIME = 'application/pdf';
const PDF_LIMITS = Object.freeze({ maximumPages: 25, lineTolerance: 2 });

function joinItems(items) {
  return items
    .sort((left, right) => left.x - right.x)
    .map(({ text }) => text.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pageLines(content, pageNumber, firstLineNumber) {
  const groups = [];
  for (const item of content.items) {
    const text = String(item.str ?? '').trim();
    if (!text) continue;
    const x = Number(item.transform?.[4] ?? 0);
    const y = Number(item.transform?.[5] ?? 0);
    let group = groups.find((candidate) => Math.abs(candidate.y - y) <= PDF_LIMITS.lineTolerance);
    if (!group) {
      group = { y, items: [] };
      groups.push(group);
    }
    group.items.push({ x, text });
  }

  return groups
    .sort((left, right) => right.y - left.y)
    .map((group, index) => {
      const line = firstLineNumber + index;
      const location = {
        page: pageNumber,
        sheet: null,
        cell: null,
        line,
        paragraph: null,
        table: null,
        row: null,
        column: null
      };
      return { line, text: joinItems(group.items), page: pageNumber, sheet: null, cell: null, location };
    })
    .filter(({ text }) => text);
}

function mapPdfError(error) {
  if (error?.name === 'PasswordException') {
    return parserError('PARSER_ENCRYPTED', 'PDF is password protected', { cause: error });
  }
  if (['InvalidPDFException', 'MissingPDFException', 'UnexpectedResponseException'].includes(error?.name)) {
    return parserError('PARSER_CORRUPT', 'PDF structure is invalid or incomplete', { cause: error });
  }
  return parserError('PARSER_UNREADABLE', 'PDF text extraction failed', { cause: error });
}

export async function parsePdfBuffer(buffer) {
  let loadingTask;
  try {
    loadingTask = getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useSystemFonts: true,
      verbosity: 0
    });
    const pdf = await loadingTask.promise;
    if (pdf.numPages > PDF_LIMITS.maximumPages) {
      throw parserError('PARSER_LIMIT_EXCEEDED', `PDF contains more than ${PDF_LIMITS.maximumPages} pages`);
    }

    const lines = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      lines.push(...pageLines(content, pageNumber, lines.length + 1));
      page.cleanup();
    }
    const text = lines.map(({ text: lineText }) => lineText).join('\n');
    const characterCount = text.replace(/\s/g, '').length;
    const scanned = characterCount < Math.max(20, pdf.numPages * 12);
    const readabilityScore = scanned ? 0 : Math.min(1, characterCount / Math.max(120, pdf.numPages * 120));
    const warnings = scanned ? ['PDF contains no usable embedded text and may be scanned'] : [];

    return {
      format: 'pdf',
      mimeType: PDF_MIME,
      text,
      lines,
      blocks: lines.map(({ text: lineText, location }) => ({ kind: 'line', text: lineText, location })),
      cells: [],
      warnings,
      readable: !scanned,
      readabilityScore,
      scanned,
      metadata: { pageCount: pdf.numPages, characterCount }
    };
  } catch (error) {
    if (error?.name === 'ParserError') throw error;
    throw mapPdfError(error);
  } finally {
    if (loadingTask) await loadingTask.destroy().catch(() => {});
  }
}
