import { describe, expect, it } from 'vitest';
import { buildSchedule, isIsoDate } from '../service/schedule';

const b = (s: string): bigint => BigInt(s);

describe('buildSchedule monthly', () => {
  it('clamps Jan 31 to Feb 28 then returns to Mar 31 (non-leap year)', () => {
    const lines = buildSchedule({ financedCents: b('300000'), count: 3, frequency: 'monthly', firstDueDate: '2026-01-31' });
    expect(lines.map((l) => l.dueDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('clamps to Feb 29 in a leap year', () => {
    const lines = buildSchedule({ financedCents: b('300000'), count: 2, frequency: 'monthly', firstDueDate: '2028-01-31' });
    expect(lines.map((l) => l.dueDate)).toEqual(['2028-01-31', '2028-02-29']);
  });

  it('clamps 30th in April and keeps the original day afterwards', () => {
    const lines = buildSchedule({ financedCents: b('400000'), count: 4, frequency: 'monthly', firstDueDate: '2026-01-30' });
    expect(lines.map((l) => l.dueDate)).toEqual(['2026-01-30', '2026-02-28', '2026-03-30', '2026-04-30']);
  });

  it('rolls over the year boundary', () => {
    const lines = buildSchedule({ financedCents: b('300000'), count: 3, frequency: 'monthly', firstDueDate: '2026-11-30' });
    expect(lines.map((l) => l.dueDate)).toEqual(['2026-11-30', '2026-12-30', '2027-01-30']);
  });
});

describe('buildSchedule amounts', () => {
  it('puts the remainder on the last line', () => {
    const lines = buildSchedule({ financedCents: b('10000'), count: 3, frequency: 'monthly', firstDueDate: '2026-01-10' });
    expect(lines.map((l) => l.amountCents)).toEqual([b('3333'), b('3333'), b('3334')]);
  });

  it('sums exactly to the financed amount', () => {
    for (const count of [1, 2, 7, 12, 60]) {
      const financed = b('123456789');
      const lines = buildSchedule({ financedCents: financed, count, frequency: 'weekly', firstDueDate: '2026-03-01' });
      const sum = lines.reduce((acc, l) => acc + l.amountCents, b('0'));
      expect(sum).toBe(financed);
      expect(lines).toHaveLength(count);
    }
  });

  it('numbers lines from 1', () => {
    const lines = buildSchedule({ financedCents: b('900'), count: 3, frequency: 'monthly', firstDueDate: '2026-01-01' });
    expect(lines.map((l) => l.seq)).toEqual([1, 2, 3]);
  });
});

describe('buildSchedule with n = 1', () => {
  it('returns one line for the whole financed amount on the first due date', () => {
    const lines = buildSchedule({ financedCents: b('250000'), count: 1, frequency: 'monthly', firstDueDate: '2026-05-15' });
    expect(lines).toEqual([{ seq: 1, dueDate: '2026-05-15', amountCents: b('250000') }]);
  });

  it('returns one weekly line on the first due date', () => {
    const lines = buildSchedule({ financedCents: b('7'), count: 1, frequency: 'weekly', firstDueDate: '2026-05-15' });
    expect(lines).toEqual([{ seq: 1, dueDate: '2026-05-15', amountCents: b('7') }]);
  });
});

describe('buildSchedule weekly', () => {
  it('steps 7 days', () => {
    const lines = buildSchedule({ financedCents: b('300'), count: 3, frequency: 'weekly', firstDueDate: '2026-01-01' });
    expect(lines.map((l) => l.dueDate)).toEqual(['2026-01-01', '2026-01-08', '2026-01-15']);
  });

  it('crosses month and year boundaries', () => {
    const lines = buildSchedule({ financedCents: b('300'), count: 3, frequency: 'weekly', firstDueDate: '2026-12-28' });
    expect(lines.map((l) => l.dueDate)).toEqual(['2026-12-28', '2027-01-04', '2027-01-11']);
  });
});

describe('buildSchedule input checks', () => {
  it('rejects count below 1', () => {
    expect(() => buildSchedule({ financedCents: b('100'), count: 0, frequency: 'monthly', firstDueDate: '2026-01-01' })).toThrow(RangeError);
  });

  it('rejects a malformed first due date', () => {
    expect(() => buildSchedule({ financedCents: b('100'), count: 1, frequency: 'monthly', firstDueDate: '2026-02-30' })).toThrow(RangeError);
  });
});

describe('isIsoDate', () => {
  it('accepts real dates only', () => {
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('26-01-01')).toBe(false);
  });
});
