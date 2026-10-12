import { describe, expect, it } from 'vitest';
import {
  isRateLimited,
  isValidSlug,
  lineSubtotal,
  nextOrderState,
  normalizeWhatsappPhone,
  RATE_LIMIT_MAX_ORDERS,
  WILAYA_RE,
} from '../service/rules';

describe('isValidSlug', () => {
  it('accepts lowercase kebab slugs', () => {
    expect(isValidSlug('boutique-ali-2')).toBe(true);
  });
  it('rejects too short, uppercase, edge hyphens and spaces', () => {
    expect(isValidSlug('ab')).toBe(false);
    expect(isValidSlug('Shop')).toBe(false);
    expect(isValidSlug('-shop')).toBe(false);
    expect(isValidSlug('shop-')).toBe(false);
    expect(isValidSlug('my shop')).toBe(false);
  });
});

describe('normalizeWhatsappPhone', () => {
  it('converts local Algerian numbers to E.164', () => {
    expect(normalizeWhatsappPhone('0661 00 00 01')).toBe('+213661000001');
  });
  it('accepts +213 and 00213 forms', () => {
    expect(normalizeWhatsappPhone('+213 555-12-34-56')).toBe('+213555123456');
    expect(normalizeWhatsappPhone('00213555123456')).toBe('+213555123456');
  });
  it('rejects garbage and empty input', () => {
    expect(normalizeWhatsappPhone('')).toBeNull();
    expect(normalizeWhatsappPhone('abc')).toBeNull();
    expect(normalizeWhatsappPhone('12')).toBeNull();
  });
});

describe('isRateLimited', () => {
  it('allows below the limit and blocks at the limit', () => {
    expect(isRateLimited(RATE_LIMIT_MAX_ORDERS - 1)).toBe(false);
    expect(isRateLimited(RATE_LIMIT_MAX_ORDERS)).toBe(true);
  });
});

describe('nextOrderState', () => {
  it('confirms and cancels only new orders', () => {
    expect(nextOrderState('new', 'confirm')).toBe('confirmed');
    expect(nextOrderState('new', 'cancel')).toBe('cancelled');
  });
  it('refuses transitions from final states', () => {
    expect(nextOrderState('confirmed', 'cancel')).toBeNull();
    expect(nextOrderState('cancelled', 'confirm')).toBeNull();
    expect(nextOrderState('confirmed', 'confirm')).toBeNull();
  });
});

describe('lineSubtotal', () => {
  it('multiplies bigint cents exactly, including the largest supported quantity', () => {
    expect(lineSubtotal(250000n, 3)).toBe(750000n);
    expect(lineSubtotal(9_007_199_254_740_993n, 99)).toBe(9_007_199_254_740_993n * 99n);
  });
  it('rejects zero, negative and fractional quantities', () => {
    expect(() => lineSubtotal(100n, 0)).toThrow(RangeError);
    expect(() => lineSubtotal(100n, -1)).toThrow(RangeError);
    expect(() => lineSubtotal(100n, 1.5)).toThrow(RangeError);
  });
});

describe('WILAYA_RE', () => {
  it('accepts 01 to 69 only', () => {
    expect(WILAYA_RE.test('01')).toBe(true);
    expect(WILAYA_RE.test('58')).toBe(true);
    expect(WILAYA_RE.test('59')).toBe(true);
    expect(WILAYA_RE.test('69')).toBe(true);
    expect(WILAYA_RE.test('00')).toBe(false);
    expect(WILAYA_RE.test('70')).toBe(false);
  });
});
