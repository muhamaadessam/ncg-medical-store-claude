import type { ErrorRequestHandler, RequestHandler } from 'express';

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

/** Throw from any handler to send `{ error: { code, message, details? } }` with `status`. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (message = 'Resource not found') =>
  new HttpError(404, 'NOT_FOUND', message);

/** 404 for unknown `/api/*` routes (registered after all API routers). */
export const apiNotFoundHandler: RequestHandler = (req, _res, next) => {
  next(notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

/** Central error handler: always JSON, never leaks stack traces in production. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  let body: ApiErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
  };

  if (err instanceof HttpError) {
    status = err.status;
    body = { error: { code: err.code, message: err.message, details: err.details } };
  } else if (isClientHttpError(err)) {
    // Errors raised by Express middleware (body-parser, serve-static) carry a 4xx status.
    status = err.status;
    if (err.type === 'entity.too.large') {
      body = { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' } };
    } else if (err.type === 'entity.parse.failed') {
      body = { error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } };
    } else if (status === 404) {
      body = { error: { code: 'NOT_FOUND', message: 'Resource not found' } };
    } else {
      body = { error: { code: 'BAD_REQUEST', message: 'Bad request' } };
    }
  }

  if (status >= 500) console.error(err);
  res.status(status).json(body);
};

function isClientHttpError(err: unknown): err is { status: number; type?: string } {
  if (typeof err !== 'object' || err === null || !('status' in err)) return false;
  const { status } = err as { status: unknown };
  return typeof status === 'number' && status >= 400 && status < 500;
}
