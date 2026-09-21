import { COMPARISON_FIELDS } from '../constants/challenge.js';
import { FIELD_NORMALIZERS } from './normalizationService.js';

export const FIELD_ALIASES = Object.freeze({
  shipper: ['shipper', 'shipper/exporter', 'shipper (principal or seller)', 'exporter'],
  consignee: ['consignee', 'consignee (non-negotiable)', 'to the order of'],
  notify_party: ['notify', 'notify party', 'notify party/intermediate consignee'],
  port_of_loading: ['port of loading', 'port of loading (pol)', 'load port', 'pol'],
  port_of_discharge: ['port of discharge', 'port of discharge (pod)', 'discharge port', 'pod'],
  container_count: ['total containers', 'container count', 'no. of containers', 'no. of containers or packages'],
  gross_weight_kg: [
    'gross weight',
    'gross weight (kg)',
    'gross weight (kgs)',
    'gross wt (kg)',
    'gross wt (kgs)',
    'total gross weight',
    'total gross weight (kg)',
    'total gross weight (kgs)',
    'total gross wt',
    'total gross wt (kg)',
    'total gross wt (kgs)'
  ]
});

export function normalizeFieldLabel(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\p{Script=Han}+/gu, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ALIAS_LOOKUP = new Map(Object.entries(FIELD_ALIASES).flatMap(([field, aliases]) => (
  aliases.map((alias) => [normalizeFieldLabel(alias), { field, alias }])
)));

function escapedAlias(alias) {
  return alias
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\ /g, '\\s+');
}

const PREFIX_MATCHERS = Object.entries(FIELD_ALIASES).flatMap(([field, aliases]) => aliases.map((alias) => ({
  field,
  alias,
  pattern: new RegExp(
    `^\\s*(${escapedAlias(alias)})(?:\\s*\\([^)]*\\p{Script=Han}[^)]*\\))?\\s*(?::|\\||\\s+)\\s*(.+?)\\s*$`,
    'iu'
  )
}))).sort((left, right) => right.alias.length - left.alias.length);

function columnNumber(column) {
  if (Number.isInteger(column)) return column;
  if (!column) return null;
  return [...String(column).toUpperCase()].reduce((total, character) => (
    total * 26 + character.charCodeAt(0) - 64
  ), 0);
}

function sameRow(left, right) {
  return left.location?.row === right.location?.row
    && left.location?.sheet === right.location?.sheet
    && left.location?.table === right.location?.table;
}

function canonicalFieldForLabel(label) {
  const normalized = normalizeFieldLabel(label)
    // Some embedded PDF fonts expose the Chinese unit label as placeholder n glyphs.
    .replace(/\s+n{1,3}\s+(?=kgs?\b)/, ' ');
  if (ALIAS_LOOKUP.has(normalized)) return ALIAS_LOOKUP.get(normalized);
  const withoutUnit = normalized.replace(/\s+(?:kg|kgs)$/, '').trim();
  return ALIAS_LOOKUP.get(withoutUnit) ?? null;
}

function primaryValue(field, value) {
  const text = String(value ?? '').trim();
  if (!['shipper', 'consignee', 'notify_party'].includes(field)) return text;
  return text.split(/\s*[;|]\s*|\r?\n/).find((part) => part.trim())?.trim() ?? text;
}

function candidate(field, rawValue, sourceLabel, evidence, location, confidence) {
  const displayValue = primaryValue(field, rawValue);
  return {
    rawValue: displayValue,
    normalizedValue: FIELD_NORMALIZERS[field](displayValue),
    sourceLabel: sourceLabel.trim(),
    evidence: evidence.trim(),
    location: {
      page: location?.page ?? null,
      sheet: location?.sheet ?? null,
      cell: location?.cell ?? null,
      line: location?.line ?? null
    },
    method: 'alias_rule',
    confidence
  };
}

function missingField(candidates = []) {
  return {
    rawValue: null,
    normalizedValue: null,
    sourceLabel: null,
    evidence: null,
    location: { page: null, sheet: null, cell: null, line: null },
    method: 'missing',
    confidence: 0,
    candidates,
    ambiguous: candidates.length > 1
  };
}

function cellCandidates(parsedDocument) {
  const candidates = Object.fromEntries(COMPARISON_FIELDS.map((field) => [field, []]));
  const cells = parsedDocument.cells ?? [];
  for (const labelCell of cells) {
    const match = canonicalFieldForLabel(labelCell.text);
    if (!match) continue;
    const labelColumn = columnNumber(labelCell.location?.column);
    const valueCell = cells.find((entry) => sameRow(entry, labelCell)
      && columnNumber(entry.location?.column) === labelColumn + 1);
    if (!valueCell?.text?.trim()) continue;
    candidates[match.field].push(candidate(
      match.field,
      valueCell.text,
      labelCell.text,
      `${labelCell.text}: ${valueCell.text}`,
      valueCell.location,
      0.995
    ));
  }
  return candidates;
}

function lineCandidates(parsedDocument) {
  const candidates = Object.fromEntries(COMPARISON_FIELDS.map((field) => [field, []]));
  for (const line of parsedDocument.lines ?? []) {
    if (line.location?.cell) continue;
    const colonIndex = line.text.indexOf(':');
    if (colonIndex > 0) {
      const sourceLabel = line.text.slice(0, colonIndex).trim();
      const rawValue = line.text.slice(colonIndex + 1).trim();
      const exactLabel = canonicalFieldForLabel(sourceLabel);
      if (exactLabel && rawValue) {
        candidates[exactLabel.field].push(candidate(
          exactLabel.field,
          rawValue,
          sourceLabel,
          line.text,
          line.location ?? line,
          parsedDocument.format === 'pdf' ? 0.96 : 0.99
        ));
        continue;
      }
    }
    for (const matcher of PREFIX_MATCHERS) {
      const match = line.text.match(matcher.pattern);
      if (!match) continue;
      candidates[matcher.field].push(candidate(
        matcher.field,
        match[2],
        match[1],
        line.text,
        line.location ?? line,
        parsedDocument.format === 'pdf' ? 0.96 : 0.99
      ));
      break;
    }
  }
  return candidates;
}

function resolveCandidates(values) {
  const usable = values.filter(({ normalizedValue }) => normalizedValue !== null && normalizedValue !== '');
  if (usable.length === 0) return missingField(values);
  const normalized = new Set(usable.map(({ normalizedValue }) => JSON.stringify(normalizedValue)));
  if (normalized.size > 1) return missingField(usable);
  const selected = usable.sort((left, right) => right.confidence - left.confidence)[0];
  return { ...selected, candidates: usable, ambiguous: false };
}

export function extractRequiredFields(parsedDocument) {
  const fromCells = cellCandidates(parsedDocument);
  const fromLines = lineCandidates(parsedDocument);
  return Object.fromEntries(COMPARISON_FIELDS.map((field) => [
    field,
    resolveCandidates([...fromCells[field], ...fromLines[field]])
  ]));
}
