/** Message key for a user-facing AI error. Services put it in `details.messageKey`; the UI translates it. */
export function errorKey(details: Record<string, unknown> | undefined): string {
  const key = details?.messageKey;
  return typeof key === 'string' ? key : 'errors.generic';
}
