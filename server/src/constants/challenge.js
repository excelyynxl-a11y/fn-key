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

export const PIPELINE_VERSION = '4.0.0-stage-4';

export const KNOWLEDGE_VERSION = 'email-phrases-2026-09-21';
export const CLASSIFICATION_PROMPT_VERSION = 'email-category-v1';
export const DOCUMENT_ROLE_PROMPT_VERSION = 'document-role-v1';
export const DOCUMENT_FIELD_PROMPT_VERSION = 'document-fields-v1';
export const DOCUMENT_AI_SCHEMA_VERSION = 'document-ai-v1';

export const KNOWLEDGE_STATUSES = Object.freeze([
  'seed',
  'probation',
  'trusted',
  'blocked',
  'retired'
]);
