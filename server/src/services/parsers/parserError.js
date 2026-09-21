export class ParserError extends Error {
  constructor(code, message, { cause = null, details = null } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ParserError';
    this.code = code;
    this.details = details;
    this.retryable = false;
  }
}

export function parserError(code, message, options) {
  return new ParserError(code, message, options);
}
