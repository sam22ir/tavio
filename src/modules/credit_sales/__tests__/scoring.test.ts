import { describe, expect, it } from 'vitest';
import { computeScore, type ScoringHistory } from '../service/scoring';

const empty: ScoringHistory = {
  paidOnTime: 0,
  paidLate: 0,
  avgDaysLate: 0,
  currentlyLate: 0,
  completedContracts: 0,
};

describe('computeScore', () => {
  it('returns new with base 70 when there is no history', () => {
    const r = computeScore(empty);
    expect(r.grade).toBe('new');
    expect(r.score).toBe(70);
    expect(r.reasons).toEqual([]);
  });

  it('adds 5 per completed contract, capped at +15', () => {
    expect(computeScore({ ...empty, completedContracts: 2 }).score).toBe(80);
    expect(computeScore({ ...empty, completedContracts: 3 }).score).toBe(85);
    expect(computeScore({ ...empty, completedContracts: 10 }).score).toBe(85);
  });

  it('adds 1 per on-time payment, capped at +15', () => {
    expect(computeScore({ ...empty, paidOnTime: 4 }).score).toBe(74);
    expect(computeScore({ ...empty, paidOnTime: 15 }).score).toBe(85);
    expect(computeScore({ ...empty, paidOnTime: 40 }).score).toBe(85);
  });

  it('subtracts 3 per late-paid installment', () => {
    expect(computeScore({ ...empty, paidLate: 1 }).score).toBe(67);
  });

  it('subtracts 10 per currently late installment', () => {
    expect(computeScore({ ...empty, currentlyLate: 1, paidOnTime: 1 }).score).toBe(61);
  });

  it('subtracts 1 per full 5 average days late', () => {
    expect(computeScore({ ...empty, paidLate: 1, avgDaysLate: 4 }).score).toBe(67);
    expect(computeScore({ ...empty, paidLate: 1, avgDaysLate: 5 }).score).toBe(66);
    expect(computeScore({ ...empty, paidLate: 1, avgDaysLate: 17 }).score).toBe(64);
  });

  it('clamps the score to 0..100', () => {
    expect(computeScore({ ...empty, currentlyLate: 20, paidLate: 3 }).score).toBe(0);
    const top = computeScore({ ...empty, completedContracts: 5, paidOnTime: 50 });
    expect(top.score).toBe(100);
  });

  it('maps bands A >= 80, B >= 60, C >= 40, else D', () => {
    expect(computeScore({ ...empty, completedContracts: 2 }).grade).toBe('A');
    expect(computeScore({ ...empty, completedContracts: 1, paidOnTime: 1 }).grade).toBe('B');
    expect(computeScore({ ...empty, currentlyLate: 2 }).grade).toBe('C');
    expect(computeScore({ ...empty, currentlyLate: 4 }).grade).toBe('D');
  });

  it('boundary: exactly 80 is A, 79 is B, 60 is B, 59 is C, 40 is C, 39 is D', () => {
    expect(computeScore({ ...empty, completedContracts: 2 }).score).toBe(80);
    expect(computeScore({ ...empty, completedContracts: 2 }).grade).toBe('A');
    expect(computeScore({ ...empty, completedContracts: 1, paidOnTime: 4 }).score).toBe(79);
    expect(computeScore({ ...empty, completedContracts: 1, paidOnTime: 4 }).grade).toBe('B');
    expect(computeScore({ ...empty, currentlyLate: 1 }).score).toBe(60);
    expect(computeScore({ ...empty, currentlyLate: 1 }).grade).toBe('B');
    expect(computeScore({ ...empty, paidLate: 3, avgDaysLate: 10 }).score).toBe(59);
    expect(computeScore({ ...empty, paidLate: 3, avgDaysLate: 10 }).grade).toBe('C');
    expect(computeScore({ ...empty, currentlyLate: 3 }).score).toBe(40);
    expect(computeScore({ ...empty, currentlyLate: 3 }).grade).toBe('C');
    expect(computeScore({ ...empty, currentlyLate: 4 }).score).toBe(30);
  });

  it('records a reason for every rule that applied', () => {
    const r = computeScore({
      paidOnTime: 2,
      paidLate: 1,
      avgDaysLate: 6,
      currentlyLate: 1,
      completedContracts: 1,
    });
    expect(r.reasons).toHaveLength(5);
    expect(r.grade).not.toBe('new');
  });
});
