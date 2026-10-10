const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a canonical UUID string. Guards URL filter values before they reach a uuid column. */
export function isUuid(value: string | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
