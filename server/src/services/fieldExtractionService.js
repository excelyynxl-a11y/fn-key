import { COMPARISON_FIELDS } from '../constants/challenge.js';
import { FIELD_NORMALIZERS } from './normalizationService.js';

const FIELD_ALIASES = Object.freeze({
  shipper: ['shipper', 'shipper/exporter'],
  consignee: ['consignee', 'consignee (non-negotiable)', 'to the order of'],
  notify_party: ['notify', 'notify party'],
  port_of_loading: ['port of loading', 'port of loading (pol)', 'load port', 'pol'],
  port_of_discharge: ['port of discharge', 'discharge port', 'pod'],
  container_count: ['total containers', 'container count', 'no. of containers or packages'],
  gross_weight_kg: ['gross weight (kg)', 'gross weight (kgs)', 'gross wt (kg)', 'gross wt (kgs)']
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const FIELD_PATTERNS = Object.fromEntries(
  Object.entries(FIELD_ALIASES).map(([field, aliases]) => [
    field,
    aliases
      .sort((left, right) => right.length - left.length)
      .map((alias) => new RegExp(`^\\s*(${escapeRegExp(alias)})\\s*:\\s*(.+?)\\s*$`, 'i'))
  ])
);

function missingField() {
  return {
    rawValue: null,
    normalizedValue: null,
    sourceLabel: null,
    evidence: null,
    location: { page: null, sheet: null, cell: null, line: null },
    method: 'missing',
    confidence: 0
  };
}

export function extractRequiredFields(parsedDocument) {
  const fields = Object.fromEntries(COMPARISON_FIELDS.map((field) => [field, missingField()]));

  for (const line of parsedDocument.lines) {
    for (const field of COMPARISON_FIELDS) {
      if (fields[field].rawValue !== null) continue;
      for (const pattern of FIELD_PATTERNS[field]) {
        const match = line.text.match(pattern);
        if (!match) continue;
        const rawValue = match[2].trim();
        fields[field] = {
          rawValue,
          normalizedValue: FIELD_NORMALIZERS[field](rawValue),
          sourceLabel: match[1].trim(),
          evidence: line.text.trim(),
          location: { page: null, sheet: null, cell: null, line: line.line },
          method: 'alias_rule',
          confidence: 0.99
        };
        break;
      }
    }
  }

  return fields;
}

