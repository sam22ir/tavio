// Pure function, no DB. Rule from src/lib/sales/schedule.ts: trunc(financed / n) per line,
// the last line takes the remainder, monthly steps clamp to end of month against the
// original day, weekly steps are 7 days.
import { splitEven } from '@/core/money';

export interface ScheduleInput {
  financedCents: bigint;           // total - down payment (+ markup)
  count: number;                   // number of installments, >= 1
  frequency: 'monthly' | 'weekly';
  firstDueDate: string;            // YYYY-MM-DD
}
export interface ScheduleLine { seq: number; dueDate: string; amountCents: bigint }

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function formatDate(y: number, m1: number, d: number): string {
  return `${pad(y, 4)}-${pad(m1, 2)}-${pad(d, 2)}`;
}

function daysInMonth(y: number, m0: number): number {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

/** Adds k calendar months to y-m-d, clamping the day to the target month's length. */
function addMonths(y: number, m1: number, d: number, k: number): string {
  const total = m1 - 1 + k;
  const year = y + Math.floor(total / 12);
  const month0 = ((total % 12) + 12) % 12;
  return formatDate(year, month0 + 1, Math.min(d, daysInMonth(year, month0)));
}

function addDays(y: number, m1: number, d: number, k: number): string {
  const dt = new Date(Date.UTC(y, m1 - 1, d + k));
  return formatDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Builds the installment plan. Callers validate input; invalid input is a programmer error. */
export function buildSchedule(input: ScheduleInput): ScheduleLine[] {
  if (!Number.isInteger(input.count) || input.count < 1) {
    throw new RangeError('buildSchedule: count must be an integer >= 1');
  }
  if (!isIsoDate(input.firstDueDate)) {
    throw new RangeError(`buildSchedule: invalid firstDueDate "${input.firstDueDate}"`);
  }
  const amounts = splitEven(input.financedCents, input.count);
  const [y, m, d] = input.firstDueDate.split('-').map(Number) as [number, number, number];
  return amounts.map((amountCents, i) => {
    const dueDate =
      input.frequency === 'monthly' ? addMonths(y, m, d, i) : addDays(y, m, d, 7 * i);
    return { seq: i + 1, dueDate, amountCents };
  });
}
