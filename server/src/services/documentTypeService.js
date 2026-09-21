function roleFromReference(reference) {
  if (/(?:^|[_-])SI(?:[_.-]|$)/i.test(reference)) return 'SI';
  if (/(?:^|[_-])BL(?:[_.-]|$)/i.test(reference)) return 'BL';
  return 'UNKNOWN';
}

const CONTENT_PATTERNS = Object.freeze({
  SI: [
    { pattern: /^\s*shipping instruction\b/im, score: 12 },
    { pattern: /^\s*bill of lading instruction\b/im, score: 12 },
    { pattern: /^\s*bl instruction\b/im, score: 12 }
  ],
  BL: [
    { pattern: /^\s*bill of lading\s*\(draft\)/im, score: 12 },
    { pattern: /^\s*draft bill of lading\b/im, score: 12 },
    { pattern: /\bbill of lading\b(?!\s+instruction)/i, score: 4 }
  ]
});

const WRONG_DOCUMENT_PATTERNS = Object.freeze([
  /\bcommercial invoice\b/i,
  /\bpacking list\b/i,
  /\bcertificate of origin\b/i,
  /\bnot (?:an? )?(?:shipping instruction|si|bill of lading|bl)\b/i
]);

function scoreAttachment(attachment) {
  const referenceRole = roleFromReference(attachment.reference ?? attachment.filename ?? '');
  const scores = { SI: referenceRole === 'SI' ? 10 : 0, BL: referenceRole === 'BL' ? 10 : 0 };
  const evidence = referenceRole === 'UNKNOWN' ? [] : [{
    source: 'filename',
    phrase: attachment.filename ?? attachment.reference,
    role: referenceRole,
    score: 10
  }];
  const text = attachment.parsedDocument?.text ?? attachment.extractedText ?? '';
  const headerText = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join('\n');
  const wrongDocumentEvidence = WRONG_DOCUMENT_PATTERNS
    .map((pattern) => String(text).match(pattern)?.[0])
    .filter(Boolean);
  for (const role of ['SI', 'BL']) {
    for (const entry of CONTENT_PATTERNS[role]) {
      const match = headerText.match(entry.pattern);
      if (!match) continue;
      scores[role] += entry.score;
      evidence.push({ source: 'content', phrase: match[0], role, score: entry.score });
    }
  }
  const ranking = Object.entries(scores).sort((left, right) => right[1] - left[1]);
  const margin = ranking[0][1] - ranking[1][1];
  const strongDocumentHeader = evidence.some(({ source, score }) => source === 'content' && score >= 8);
  const wrongTypeDetected = wrongDocumentEvidence.length > 0 && !strongDocumentHeader;
  if (wrongTypeDetected) {
    evidence.push(...wrongDocumentEvidence.map((phrase) => ({
      source: 'content', phrase, role: 'UNKNOWN', score: 10
    })));
  }
  const documentType = !wrongTypeDetected && ranking[0][1] >= 3 && margin >= 2 ? ranking[0][0] : 'UNKNOWN';
  return {
    ...attachment,
    documentType,
    roleScores: scores,
    roleEvidence: evidence,
    roleMargin: margin,
    wrongTypeDetected
  };
}

export function identifyDocumentRoles(attachments) {
  const identified = attachments.map(scoreAttachment);
  const si = identified.filter((attachment) => attachment.documentType === 'SI');
  const bl = identified.filter((attachment) => attachment.documentType === 'BL');

  return {
    si: si.length === 1 ? si[0] : null,
    bl: bl.length === 1 ? bl[0] : null,
    valid: si.length === 1 && bl.length === 1,
    ambiguous: si.length !== 1 || bl.length !== 1,
    wrongTypeDetected: identified.some((attachment) => attachment.wrongTypeDetected),
    attachments: identified
  };
}

