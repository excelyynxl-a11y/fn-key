import { parseAttachment } from './fileParserService.js';

function parserStatusFor(error) {
  return error?.code === 'PARSER_UNSUPPORTED' ? 'unsupported' : 'unreadable';
}

export async function parseEmailAttachments(attachments, repository) {
  return Promise.all(attachments.map(async (attachment) => {
    if (attachment.exists === false) {
      return {
        ...attachment,
        parserStatus: 'unreadable',
        parserError: { code: 'ATTACHMENT_MISSING', message: 'Referenced attachment does not exist' }
      };
    }

    try {
      const buffer = await repository.readAttachment(attachment.reference);
      const parsedDocument = await parseAttachment(buffer, attachment);
      return {
        ...attachment,
        parserStatus: parsedDocument.readable ? 'parsed' : 'unreadable',
        detectedFormat: parsedDocument.format,
        detectedMimeType: parsedDocument.mimeType,
        extractedText: parsedDocument.text,
        parserWarnings: parsedDocument.warnings,
        readabilityScore: parsedDocument.readabilityScore,
        scanned: parsedDocument.scanned,
        parserMetadata: parsedDocument.metadata,
        parserError: parsedDocument.readable
          ? { code: null, message: null }
          : { code: parsedDocument.scanned ? 'PARSER_SCANNED' : 'PARSER_EMPTY', message: parsedDocument.warnings[0] ?? 'Attachment has no readable content' },
        parsedDocument,
        buffer
      };
    } catch (error) {
      return {
        ...attachment,
        parserStatus: parserStatusFor(error),
        detectedFormat: null,
        detectedMimeType: null,
        extractedText: null,
        parserWarnings: [],
        readabilityScore: 0,
        scanned: false,
        parserMetadata: {},
        parserError: { code: error?.code ?? 'PARSER_UNREADABLE', message: error?.message ?? 'Attachment parsing failed' }
      };
    }
  }));
}

export function attachmentForPersistence(attachment) {
  const { parsedDocument: _parsedDocument, buffer: _buffer, ...persisted } = attachment;
  return persisted;
}
