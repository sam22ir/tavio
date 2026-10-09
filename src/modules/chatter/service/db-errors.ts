/** True when a database error is a unique violation (Postgres 23505). */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === '23505';
}

/** True when a database error is a check violation (Postgres 23514). */
export function isCheckViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === '23514';
}
