export const EMAIL_CATEGORIES = Object.freeze([
  'BL_COMPARISON',
  'SI_REQUEST',
  'INVOICE_QUERY',
  'GENERAL',
  'SPAM'
]);

export const COMPARISON_STATUSES = Object.freeze([
  'OK',
  'MISMATCH',
  'NEEDS_REVIEW'
]);

export const REVIEW_REASONS = Object.freeze([
  'wrong_doc_type',
  'missing_attachment',
  'unreadable',
  'missing_value'
]);

export const COMPARISON_FIELDS = Object.freeze([
  'shipper',
  'consignee',
  'notify_party',
  'port_of_loading',
  'port_of_discharge',
  'container_count',
  'gross_weight_kg'
]);

export const PIPELINE_VERSION = '1.0.0-stage-1';

