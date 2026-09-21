const REPLACEMENT_CHARACTER = '\uFFFD';

export function parseTextBuffer(buffer) {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const replacementCount = [...text].filter((character) => character === REPLACEMENT_CHARACTER).length;
  const replacementRatio = text.length === 0 ? 1 : replacementCount / text.length;
  const lines = text.split(/\r?\n/).map((line, index) => ({
    line: index + 1,
    text: line.trimEnd()
  }));

  return {
    text,
    lines,
    readable: text.trim().length > 0 && replacementRatio < 0.01,
    warnings: replacementCount > 0 ? [`Found ${replacementCount} invalid UTF-8 characters`] : []
  };
}

