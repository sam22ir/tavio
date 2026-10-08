import { describe, expect, it } from 'vitest';
import { applyRate, formatDzd, parseDzd, roundHalfUp, splitEven, sumCents, type Cents } from './index';

// BigInt literals need target ES2020; the project targets lower, so use BigInt().
const b = (s: string): Cents => BigInt(s);

describe('parseDzd', () => {
  it('parses valid amounts', () => {
    expect(parseDzd('1234')).toBe(b('123400'));
    expect(parseDzd('1234.5')).toBe(b('123450'));
    expect(parseDzd('1 234,50')).toBe(b('123450'));
    expect(parseDzd('1234,5 DA')).toBe(b('123450'));
    expect(parseDzd('1 234,05')).toBe(b('123405'));
    expect(parseDzd('0')).toBe(b('0'));
  });

  it('rejects invalid input', () => {
    expect(parseDzd('12,345')).toBeNull();
    expect(parseDzd('')).toBeNull();
    expect(parseDzd('abc')).toBeNull();
    expect(parseDzd('-5')).toBeNull();
    expect(parseDzd('1.2.3')).toBeNull();
  });
});

describe('formatDzd', () => {
  it('formats in each locale without throwing', () => {
    for (const locale of ['fr', 'ar', 'en'] as const) {
      expect(formatDzd(b('123450'), locale).length).toBeGreaterThan(0);
    }
  });

  it('formats large and negative values exactly', () => {
    expect(formatDzd(b('123456789012345678'), 'en')).toContain('1,234,567,890,123,456.78');
    expect(formatDzd(b('-5'), 'en')).toContain('0.05');
    expect(formatDzd(b('-5'), 'en')).toContain('-');
  });
});

describe('roundHalfUp', () => {
  it('rounds half away from zero', () => {
    expect(roundHalfUp(b('5'), b('10'))).toBe(b('1'));
    expect(roundHalfUp(b('-5'), b('10'))).toBe(b('-1'));
    expect(roundHalfUp(b('4'), b('10'))).toBe(b('0'));
    expect(roundHalfUp(b('-4'), b('10'))).toBe(b('0'));
    expect(roundHalfUp(b('0'), b('10'))).toBe(b('0'));
  });

  it('rejects non-positive denominators', () => {
    expect(() => roundHalfUp(b('1'), b('0'))).toThrow(RangeError);
  });
});

describe('applyRate', () => {
  it('applies integer and decimal rates', () => {
    expect(applyRate(b('1000'), '19')).toBe(b('190'));
    expect(applyRate(b('1000'), '19.0000')).toBe(b('190'));
    expect(applyRate(b('5'), '9')).toBe(b('0'));
    expect(applyRate(b('-1000'), '19')).toBe(b('-190'));
    expect(applyRate(b('0'), '19')).toBe(b('0'));
  });

  it('rounds exact .5 half-up', () => {
    // 50 * 1 / 100 = 0.5 -> 1
    expect(applyRate(b('50'), '1')).toBe(b('1'));
  });

  it('handles large values without float error', () => {
    // 9007199254740993 * 100 cents * 19% = 9007199254740993 * 19 cents, exact
    expect(applyRate(b('900719925474099300'), '19')).toBe(b('171136785840078867'));
    expect(applyRate(b('1000000000000000'), '19.5')).toBe(b('195000000000000'));
  });

  it('throws on malformed rates', () => {
    expect(() => applyRate(b('100'), '1.23456')).toThrow(RangeError);
    expect(() => applyRate(b('100'), 'abc')).toThrow(RangeError);
  });
});

describe('splitEven', () => {
  it('gives the remainder to the last part', () => {
    expect(splitEven(b('1000'), 3)).toEqual([b('333'), b('333'), b('334')]);
    expect(splitEven(b('0'), 4)).toEqual([b('0'), b('0'), b('0'), b('0')]);
    expect(splitEven(b('-10'), 3)).toEqual([b('-3'), b('-3'), b('-4')]);
  });

  it('returns the total for n = 1 and sums correctly', () => {
    expect(splitEven(b('777'), 1)).toEqual([b('777')]);
    const total = b('1000000000000000007');
    expect(sumCents(splitEven(total, 7))).toBe(total);
  });

  it('rejects n < 1', () => {
    expect(() => splitEven(b('100'), 0)).toThrow(RangeError);
  });
});

describe('sumCents', () => {
  it('sums values including zero and negatives', () => {
    expect(sumCents([])).toBe(b('0'));
    expect(sumCents([b('100'), b('-30'), b('0'), b('5')])).toBe(b('75'));
  });
});
