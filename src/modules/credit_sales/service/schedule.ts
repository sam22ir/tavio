// STUB owned by W4-E. Pure function, no DB.
export interface ScheduleInput {
  financedCents: bigint;           // total - down payment (+ markup)
  count: number;                   // number of installments, >= 1
  frequency: 'monthly' | 'weekly';
  firstDueDate: string;            // YYYY-MM-DD
}
export interface ScheduleLine { seq: number; dueDate: string; amountCents: bigint }
/** trunc(financed / n) per line, last line takes the remainder; monthly steps clamp to end of month; weekly = +7 days. */
export function buildSchedule(_input: ScheduleInput): ScheduleLine[] { throw new Error('not implemented'); }
