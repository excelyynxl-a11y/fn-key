import { COMPARISON_FIELDS } from '../constants/challenge.js';
import { classifyEmail } from './adaptiveClassificationService.js';
import { attachmentForPersistence, parseEmailAttachments } from './attachmentService.js';
import { compareDocuments } from './comparisonService.js';
import { detectDocumentRolesWithAi, extractDocumentFieldsWithAi } from './documentAiService.js';
import { identifyDocumentRoles } from './documentTypeService.js';
import { extractRequiredFields } from './fieldExtractionService.js';

function reviewResult(category, reviewReason) {
  return {
    category,
    status: 'NEEDS_REVIEW',
    reviewReason,
    hasDefect: false,
    defectFields: [],
    fieldDetails: {}
  };
}

function roleDocument(attachment, fields) {
  return {
    attachmentReference: attachment.reference,
    documentType: attachment.documentType,
    roleMethod: attachment.roleMethod ?? 'rule',
    roleConfidence: attachment.roleConfidence ?? Math.min(0.99, 0.6 + attachment.roleMargin / 20),
    roleEvidence: attachment.roleEvidence ?? [],
    fields
  };
}

function attachRoleEvidence(attachments, roles) {
  const decisions = new Map(roles.attachments.map((attachment) => [attachment.reference, attachment]));
  return attachments.map((attachment) => {
    const decision = decisions.get(attachment.reference);
    return {
      ...attachment,
      documentType: decision?.documentType ?? 'UNKNOWN',
      roleMethod: decision?.documentType && decision.documentType !== 'UNKNOWN' ? 'rule' : null,
      roleScores: decision?.roleScores ?? {},
      roleEvidence: decision?.roleEvidence ?? [],
      roleMargin: decision?.roleMargin ?? 0
    };
  });
}

function parsedByReference(attachments, reference) {
  return attachments.find((attachment) => attachment.reference === reference);
}

function mergeAiFields(ruleFields, aiFields) {
  return Object.fromEntries(COMPARISON_FIELDS.map((field) => [
    field,
    ruleFields[field]?.normalizedValue !== null && ruleFields[field]?.normalizedValue !== undefined
      ? ruleFields[field]
      : aiFields[field] ?? ruleFields[field]
  ]));
}

async function resolveDocumentRoles(attachments, options) {
  const ruleRoles = identifyDocumentRoles(attachments);
  if (ruleRoles.valid || ruleRoles.wrongTypeDetected) {
    return {
      roles: ruleRoles,
      attachments: attachRoleEvidence(attachments, ruleRoles),
      aiError: null
    };
  }
  const roleFallback = options.documentRoleAi ?? detectDocumentRolesWithAi;
  try {
    const roles = await roleFallback(attachments, options.documentAiOptions ?? {});
    return { roles, attachments: roles.attachments, aiError: null };
  } catch (error) {
    return {
      roles: ruleRoles,
      attachments: attachRoleEvidence(attachments, ruleRoles),
      aiError: { code: error?.code ?? 'AI_DOCUMENT_FAILED', message: error?.message ?? 'Role fallback failed' }
    };
  }
}

async function resolveDocumentFields(attachment, options) {
  const ruleFields = extractRequiredFields(attachment.parsedDocument);
  const requestedFields = missingRequiredFields(ruleFields);
  if (requestedFields.length === 0) return { fields: ruleFields, usedAi: false, aiError: null };

  const fieldFallback = options.documentFieldAi ?? extractDocumentFieldsWithAi;
  try {
    const fallback = await fieldFallback(attachment, requestedFields, options.documentAiOptions ?? {});
    return {
      fields: mergeAiFields(ruleFields, fallback.fields ?? {}),
      usedAi: true,
      aiError: null,
      aiMetadata: {
        cacheHit: fallback.cacheHit ?? false,
        responseId: fallback.responseId ?? null,
        attempts: fallback.attempts ?? 0,
        usage: fallback.usage ?? null
      }
    };
  } catch (error) {
    return {
      fields: ruleFields,
      usedAi: false,
      aiError: { code: error?.code ?? 'AI_DOCUMENT_FAILED', message: error?.message ?? 'Field fallback failed' }
    };
  }
}

export function missingRequiredFields(fields) {
  return COMPARISON_FIELDS.filter((field) => (
    fields[field]?.normalizedValue === null
    || fields[field]?.normalizedValue === undefined
    || fields[field]?.normalizedValue === ''
  ));
}

export async function processEmail(email, repository, options = {}) {
  const sourceEmail = { emailId: email.emailId ?? email.email_id, ...(email.source ?? email) };
  const classification = await classifyEmail(sourceEmail, options);
  const sourceAttachments = email.source?.attachments ?? email.attachments ?? [];
  if (classification.category !== 'BL_COMPARISON') {
    return {
      classification,
      attachments: sourceAttachments,
      documents: {},
      result: {
        category: classification.category,
        status: 'OK',
        reviewReason: null,
        hasDefect: false,
        defectFields: [],
        fieldDetails: {}
      }
    };
  }

  if (sourceAttachments.length < 2 || sourceAttachments.some((attachment) => attachment.exists === false)) {
    return {
      classification,
      attachments: sourceAttachments,
      documents: {},
      result: reviewResult(classification.category, 'missing_attachment')
    };
  }

  let parsedAttachments = await parseEmailAttachments(sourceAttachments, repository);
  const hardUnreadable = parsedAttachments.filter(({ parserStatus, parserError }) => (
    parserStatus !== 'parsed' && parserError?.code !== 'PARSER_SCANNED'
  ));
  if (hardUnreadable.length > 0) {
    return {
      classification,
      attachments: parsedAttachments.map(attachmentForPersistence),
      documents: {},
      result: reviewResult(classification.category, 'unreadable')
    };
  }

  const hasScannedAttachment = parsedAttachments.some(({ parserError }) => parserError?.code === 'PARSER_SCANNED');
  const roleResolution = await resolveDocumentRoles(parsedAttachments, options);
  const roles = roleResolution.roles;
  parsedAttachments = roleResolution.attachments;
  if (!roles.valid) {
    return {
      classification,
      attachments: parsedAttachments.map(attachmentForPersistence),
      documents: {},
      result: reviewResult(classification.category, hasScannedAttachment ? 'unreadable' : 'wrong_doc_type')
    };
  }

  const siAttachment = parsedByReference(parsedAttachments, roles.si.reference);
  const blAttachment = parsedByReference(parsedAttachments, roles.bl.reference);
  const [siExtraction, blExtraction] = await Promise.all([
    resolveDocumentFields(siAttachment, options),
    resolveDocumentFields(blAttachment, options)
  ]);
  const siFields = siExtraction.fields;
  const blFields = blExtraction.fields;
  const comparison = compareDocuments(siFields, blFields);
  const hasUnverifiedAiEvidence = [siFields, blFields].some((fields) => (
    Object.values(fields).some(({ method, evidenceVerified }) => method === 'ai' && evidenceVerified !== true)
  ));
  const finalComparison = hasScannedAttachment || hasUnverifiedAiEvidence
    ? reviewResult(classification.category, 'unreadable')
    : comparison;

  return {
    classification,
    attachments: parsedAttachments.map(attachmentForPersistence),
    documents: {
      si: roleDocument(siAttachment, siFields),
      bl: roleDocument(blAttachment, blFields)
    },
    result: {
      category: classification.category,
      ...finalComparison
    }
  };
}
