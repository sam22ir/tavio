import type { AppError } from '@/core/result';

/** i18n key for a service error. Users never see error.message (English, for logs). */
export function messageKeyFor(error: AppError): string {
  return `purchases.errors.${error.code.toLowerCase()}`;
}
