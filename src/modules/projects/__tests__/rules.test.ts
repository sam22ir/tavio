import { describe, expect, it } from 'vitest';
import { canChangeProjectState, parseHours, sumHours } from '../service/rules';

describe('parseHours', () => {
  it('accepts whole and fractional hours and normalises to two decimals', () => {
    expect(parseHours('1')).toEqual({ ok: true, value: '1.00' });
    expect(parseHours('1.5')).toEqual({ ok: true, value: '1.50' });
    expect(parseHours('2,25')).toEqual({ ok: true, value: '2.25' });
    expect(parseHours(' 24 ')).toEqual({ ok: true, value: '24.00' });
  });

  it('rejects zero, negatives, more than 24 hours and malformed input', () => {
    expect(parseHours('0').ok).toBe(false);
    expect(parseHours('0.00').ok).toBe(false);
    expect(parseHours('-1').ok).toBe(false);
    expect(parseHours('24.5').ok).toBe(false);
    expect(parseHours('1.234').ok).toBe(false);
    expect(parseHours('abc').ok).toBe(false);
    expect(parseHours('').ok).toBe(false);
  });
});

describe('sumHours', () => {
  it('sums decimal strings exactly', () => {
    expect(sumHours(['1.50', '2.25', '0.10'])).toBe('3.85');
    expect(sumHours([])).toBe('0.00');
  });
});

describe('canChangeProjectState', () => {
  it('allows a real change and rejects a same-state move', () => {
    expect(canChangeProjectState('active', 'done')).toBe(true);
    expect(canChangeProjectState('archived', 'active')).toBe(true);
    expect(canChangeProjectState('done', 'done')).toBe(false);
  });
});
