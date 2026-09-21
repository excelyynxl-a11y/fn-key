import { KNOWLEDGE_VERSION } from '../constants/challenge.js';
import { FIELD_ALIASES } from '../services/fieldExtractionService.js';

function entry(kind, target, phrase, weight, allowedLocations) {
  return {
    kind, target, phrase, weight, allowedLocations,
    status: 'seed', source: 'team_seed', sourceVersion: KNOWLEDGE_VERSION,
    supportCount: 0, conflictCount: 0, usageCount: 0
  };
}

export const DOCUMENT_KNOWLEDGE_SEEDS = Object.freeze([
  entry('document_label', 'SI', 'shipping instruction', 8, ['filename', 'header']),
  entry('document_label', 'SI', 'bill of lading instruction', 10, ['header']),
  entry('document_label', 'SI', 'bl instruction', 8, ['header']),
  entry('document_label', 'BL', 'bill of lading (draft)', 10, ['header']),
  entry('document_label', 'BL', 'draft bill of lading', 10, ['header']),
  entry('document_label', 'BL', 'bill of lading', 4, ['filename', 'header']),
  ...Object.entries(FIELD_ALIASES).flatMap(([field, aliases]) => (
    aliases.map((alias) => entry('field_alias', field, alias, 5, ['line', 'cell']))
  ))
]);
