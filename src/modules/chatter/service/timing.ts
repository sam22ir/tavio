const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DelayUnit = 'days' | 'weeks';

/** Adds whole days to a YYYY-MM-DD date. Pure calendar arithmetic, no timezone. */
export function addDays(dateIso: string, days: number): string {
  if (!DATE_RE.test(dateIso)) throw new Error(`Invalid date ${dateIso}`);
  const [y, m, d] = dateIso.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Due date for a delay of `count` units (days or weeks) after `fromIso`. */
export function dueAfter(fromIso: string, count: number, unit: DelayUnit): string {
  return addDays(fromIso, unit === 'weeks' ? count * 7 : count);
}
