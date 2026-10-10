import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from '../errors';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res
    .status(404)
    .json({ error: { code: 'not_found', message: 'Resource not found' } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details === undefined ? {} : { details: err.details }),
      },
    });
    return;
  }
  console.error(err);
  res
    .status(500)
    .json({ error: { code: 'internal_error', message: 'Something went wrong' } });
};
