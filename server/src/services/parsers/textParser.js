const REPLACEMENT_CHARACTER = '\uFFFD';

export function parseTextBuffer(buffer) {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const replacementCount = [...text].filter((character) => character === REPLACEMENT_CHARACTER).length;
  const replacementRatio = text.length === 0 ? 1 : replacementCount / text.length;
  const lines = text.split(/\r?\n/).map((line, index) => {
    const lineNumber = index + 1;
    const location = {
      page: null,
      sheet: null,
      cell: null,
      line: lineNumber,
      paragraph: null,
      table: null,
      row: null,
      column: null
    };
    return { line: lineNumber, text: line.trimEnd(), page: null, sheet: null, cell: null, location };
  });

  const readable = text.trim().length > 0 && replacementRatio < 0.01;

  return {
    format: 'txt',
    mimeType: 'text/plain',
    text,
    lines,
    blocks: lines.filter(({ text: lineText }) => lineText.trim()).map(({ text: lineText, location }) => ({
      kind: 'line', text: lineText, location
    })),
    cells: [],
    readable,
    readabilityScore: readable ? Math.max(0, 1 - replacementRatio * 100) : 0,
    scanned: false,
    warnings: replacementCount > 0 ? [`Found ${replacementCount} invalid UTF-8 characters`] : [],
    metadata: { lineCount: lines.length, replacementCount }
  };
}

