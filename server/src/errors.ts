export type ErrorCode =
  | 'validation_error'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'internal_error';

const STATUS: Record<ErrorCode, number> = {
  validation_error: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  internal_error: 500,
};

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get status(): number {
    return STATUS[this.code];
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError('validation_error', message, details);
export const unauthenticated = (message = 'Authentication required') =>
  new ApiError('unauthenticated', message);
export const forbidden = (message = 'You do not have permission to do that') =>
  new ApiError('forbidden', message);
export const notFound = (message = 'Resource not found') =>
  new ApiError('not_found', message);
export const conflict = (message: string) => new ApiError('conflict', message);
