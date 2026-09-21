import { classifyEmail } from './adaptiveClassificationService.js';
import { compareDocuments } from './comparisonService.js';
import { identifyDocumentRoles } from './documentTypeService.js';
import { extractRequiredFields } from './fieldExtractionService.js';
import { parseTextBuffer } from './parsers/textParser.js';

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

export async function processEmail(email, repository, options = {}) {
  const sourceEmail = { emailId: email.emailId ?? email.email_id, ...(email.source ?? email) };
  const classification = await classifyEmail(sourceEmail, options);
  if (classification.category !== 'BL_COMPARISON') {
    return {
      classification,
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

  const attachments = email.source?.attachments ?? email.attachments ?? [];
  if (attachments.length < 2 || attachments.some((attachment) => attachment.exists === false)) {
    return { classification, documents: {}, result: reviewResult(classification.category, 'missing_attachment') };
  }

  const roles = identifyDocumentRoles(attachments);
  if (!roles.valid) {
    return { classification, documents: {}, result: reviewResult(classification.category, 'wrong_doc_type') };
  }

  if (roles.si.extension !== '.txt' || roles.bl.extension !== '.txt') {
    return { classification, documents: {}, result: reviewResult(classification.category, 'unreadable') };
  }

  const [siParsed, blParsed] = await Promise.all([
    repository.readAttachment(roles.si.reference).then(parseTextBuffer),
    repository.readAttachment(roles.bl.reference).then(parseTextBuffer)
  ]);
  if (!siParsed.readable || !blParsed.readable) {
    return { classification, documents: {}, result: reviewResult(classification.category, 'unreadable') };
  }

  const siFields = extractRequiredFields(siParsed);
  const blFields = extractRequiredFields(blParsed);
  const comparison = compareDocuments(siFields, blFields);

  return {
    classification,
    documents: {
      si: {
        attachmentReference: roles.si.reference,
        documentType: 'SI',
        fields: siFields
      },
      bl: {
        attachmentReference: roles.bl.reference,
        documentType: 'BL',
        fields: blFields
      }
    },
    result: {
      category: classification.category,
      ...comparison
    }
  };
}
