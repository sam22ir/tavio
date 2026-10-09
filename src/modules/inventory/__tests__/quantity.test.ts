import { describe, expect, it } from 'vitest';
import { fromMilli, parseCountedQty, parsePositiveQty, sumQty, toMilli } from '../service/quantity';

describe('toMilli / fromMilli', () => {
  it('round-trips decimal strings with three places', () => {
    expect(toMilli('12.5')).toBe(12500n);
    expect(toMilli('-0.003')).toBe(-3n);
    expect(fromMilli(12500n)).toBe('12.500');
    expect(fromMilli(-3n)).toBe('-0.003');
    expect(fromMilli(0n)).toBe('0.000');
  });

  it('rejects more than three decimals and non-numeric input', () => {
    expect(toMilli('1.2345')).toBeNull();
    expect(toMilli('abc')).toBeNull();
    expect(toMilli('1e3')).toBeNull();
  });
});

describe('parsePositiveQty', () => {
  it('normalises positive quantities', () => {
    expect(parsePositiveQty('3')).toBe('3.000');
    expect(parsePositiveQty(' 2.5 ')).toBe('2.500');
  });

  it('rejects zero, negatives and oversized values', () => {
    expect(parsePositiveQty('0')).toBeNull();
    expect(parsePositiveQty('-1')).toBeNull();
    expect(parsePositiveQty('100000000000')).toBeNull();
    expect(parsePositiveQty('1.0001')).toBeNull();
  });
});

describe('parseCountedQty', () => {
  it('accepts zero but not negatives', () => {
    expect(parseCountedQty('0')).toBe('0.000');
    expect(parseCountedQty('-2')).toBeNull();
  });
});

describe('sumQty', () => {
  it('sums exactly and counts invalid entries', () => {
    expect(sumQty(['0.1', '0.2', 'x'])).toEqual({ total: 300n, invalid: 1 });
  });
});
