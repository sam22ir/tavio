import { describe, expect, it } from 'vitest';
import { addDays, dueAfter } from '../service/timing';

describe('chatter timing', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-10', 0)).toBe('2026-10-10');
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('turns a delay in weeks into days', () => {
    expect(dueAfter('2026-10-10', 2, 'weeks')).toBe('2026-10-24');
    expect(dueAfter('2026-10-10', 2, 'days')).toBe('2026-10-12');
  });

  it('rejects malformed dates', () => {
    expect(() => addDays('10/10/2026', 1)).toThrow('Invalid date');
  });
});
