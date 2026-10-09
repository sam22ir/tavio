import { z } from 'zod';

// Pure condition logic. No I/O, so it is unit tested without a database.
export const OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'] as const;
export type Op = (typeof OPS)[number];

export interface Condition { field: string; op: Op; value: string }

export const conditionSchema = z.object({
  field: z.string().min(1).max(100).regex(/^[A-Za-z0-9_.]+$/, 'Invalid field path'),
  op: z.enum(OPS),
  value: z.string().max(200),
});
export const conditionsSchema = z.array(conditionSchema).max(20);

/** Reads a dot-separated path from the payload. Returns undefined when any segment is missing. */
export function readPath(payload: unknown, path: string): unknown {
  let cur: unknown = payload;
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || !Object.prototype.hasOwnProperty.call(cur, key)) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

// Amounts travel as decimal strings (bigint cents), so numeric comparison accepts strings too.
function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
  return undefined;
}

export function matchesCondition(payload: unknown, c: Condition): boolean {
  const actual = readPath(payload, c.field);
  // A missing or non-scalar field never matches, including for neq.
  if (actual === undefined || actual === null || typeof actual === 'object') return false;
  if (c.op === 'eq') return String(actual) === c.value;
  if (c.op === 'neq') return String(actual) !== c.value;
  const a = toNumber(actual);
  const b = toNumber(c.value);
  if (a === undefined || b === undefined) return false;
  switch (c.op) {
    case 'gt': return a > b;
    case 'gte': return a >= b;
    case 'lt': return a < b;
    case 'lte': return a <= b;
  }
}

/** All conditions must hold. An empty list matches every event. */
export function matchesConditions(payload: unknown, conditions: readonly Condition[]): boolean {
  return conditions.every((c) => matchesCondition(payload, c));
}
