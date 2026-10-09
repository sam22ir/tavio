import { err, ok, type Result } from '@/core/result';

export const PROJECT_STATES = ['active', 'done', 'archived'] as const;
export type ProjectState = (typeof PROJECT_STATES)[number];

export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Stages created with every new project, in display order. */
export const DEFAULT_STAGES: readonly string[] = ['To do', 'In progress', 'Done'];

const HOURS_RE = /^(\d{1,2})(?:[.,](\d{1,2}))?$/;

/**
 * Parses hours typed by a user ("1", "1.5", "1,25"). Returns a decimal string with at most 2 decimals.
 * Rejects zero, negatives, more than 24 hours and malformed input.
 */
export function parseHours(raw: string): Result<string> {
  const match = HOURS_RE.exec(raw.trim());
  if (!match) return err('VALIDATION', 'Invalid hours');
  const whole = Number(match[1]);
  const frac = (match[2] ?? '0').padEnd(2, '0');
  const hundredths = whole * 100 + Number(frac);
  if (hundredths <= 0 || hundredths > 2400) {
    return err('VALIDATION', 'Hours must be greater than 0 and at most 24');
  }
  return ok(`${whole}.${frac}`);
}

/** Allowed project state changes. Same-state moves are rejected. */
export function canChangeProjectState(from: ProjectState, to: ProjectState): boolean {
  return from !== to;
}

/** Sums hours given as decimal strings, in hundredths of an hour (exact, no floats). */
export function sumHours(values: readonly string[]): string {
  const total = values.reduce((acc, v) => {
    const [w, f = '0'] = v.split('.');
    return acc + Number(w) * 100 + Number(f.padEnd(2, '0'));
  }, 0);
  return `${Math.floor(total / 100)}.${String(total % 100).padStart(2, '0')}`;
}
