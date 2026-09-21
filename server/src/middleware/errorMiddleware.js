import { ZodError } from 'zod';

export function notFoundHandler(req, res) {
  res.status(404).json({
    data: null,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} was not found`, retryable: false },
    meta: {}
  });
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof ZodError) {
    return res.status(422).json({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', retryable: false, details: error.issues },
      meta: {}
    });
  }

  const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  if (status >= 500) console.error(error);
  return res.status(status).json({
    data: null,
    error: {
      code: error.code ?? 'INTERNAL_ERROR',
      message: status >= 500 ? 'An unexpected error occurred' : error.message,
      retryable: error.retryable ?? status >= 500
    },
    meta: {}
  });
}

