// Pure HR rules: no database access, so they can be unit-tested now.

export const LEAVE_STATES = ['draft', 'submitted', 'approved', 'refused'] as const;
export type LeaveState = (typeof LEAVE_STATES)[number];

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** True for a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(value: string): boolean {
  const m = ISO_DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/**
 * Inclusive calendar days between two ISO dates, as a numeric(14,3) string (e.g. "3.000").
 * Returns null when a date is invalid or `to` is before `from`.
 */
export function countLeaveDays(from: string, to: string): string | null {
  if (!isIsoDate(from) || !isIsoDate(to)) return null;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (end < start) return null;
  const days = Math.round((end - start) / MS_PER_DAY) + 1;
  return `${days}.000`;
}

const LEAVE_TRANSITIONS: Record<LeaveState, readonly LeaveState[]> = {
  draft: ['submitted'],
  submitted: ['approved', 'refused'],
  approved: [],
  refused: [],
};

/** Leave requests move draft -> submitted -> approved | refused. Nothing else. */
export function canTransitionLeave(from: LeaveState, to: LeaveState): boolean {
  return LEAVE_TRANSITIONS[from].includes(to);
}

/** Whole minutes between check-in and check-out. Null while the attendance is still open. */
export function attendanceMinutes(checkIn: Date, checkOut: Date | null): number | null {
  if (checkOut === null) return null;
  const ms = checkOut.getTime() - checkIn.getTime();
  if (ms < 0) return null;
  return Math.floor(ms / 60_000);
}

export interface AttendanceSpan {
  employeeId: string;
  checkIn: Date;
  checkOut: Date | null;
}

export interface AttendanceSummaryRow {
  employeeId: string;
  daysPresent: number;
  minutes: number;
  openCount: number;
}

/** Totals per employee for the given month (YYYY-MM), counting by check-in date (UTC). */
export function summarizeAttendance(spans: readonly AttendanceSpan[], month: string): AttendanceSummaryRow[] {
  const byEmployee = new Map<string, { days: Set<string>; minutes: number; openCount: number }>();
  for (const span of spans) {
    const key = span.checkIn.toISOString().slice(0, 7);
    if (key !== month) continue;
    const entry = byEmployee.get(span.employeeId) ?? { days: new Set<string>(), minutes: 0, openCount: 0 };
    entry.days.add(span.checkIn.toISOString().slice(0, 10));
    const minutes = attendanceMinutes(span.checkIn, span.checkOut);
    if (minutes === null) entry.openCount += 1;
    else entry.minutes += minutes;
    byEmployee.set(span.employeeId, entry);
  }
  return [...byEmployee.entries()]
    .map(([employeeId, e]) => ({
      employeeId,
      daysPresent: e.days.size,
      minutes: e.minutes,
      openCount: e.openCount,
    }))
    .sort((a, b) => a.employeeId.localeCompare(b.employeeId));
}

/** Formats minutes as hours with two decimals, e.g. 90 -> "1.50". */
export function minutesToHours(minutes: number): string {
  return (Math.round(minutes / 0.6) / 100).toFixed(2);
}
