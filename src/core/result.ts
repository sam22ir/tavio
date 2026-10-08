export type ErrorCode =
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION'
  | 'CONFLICT' | 'STATE' | 'MODULE_DISABLED' | 'INTERNAL';
export interface AppError { code: ErrorCode; message: string; details?: Record<string, unknown> }
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = (code: ErrorCode, message: string, details?: Record<string, unknown>): Result<never> =>
  ({ ok: false, error: { code, message, details } });
