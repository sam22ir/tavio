import { describe, expect, it } from 'vitest';
import { conditionsSchema, matchesCondition, matchesConditions, readPath, type Condition } from '../conditions';

const payload = {
  orderId: '8f0c2d7e-1b2a-4c3d-9e8f-123456789abc',
  totalCents: '250000',
  method: 'cash',
  customer: { wilaya: '16', vip: true },
  lines: [{ productId: null }],
};

const c = (field: string, op: Condition['op'], value: string): Condition => ({ field, op, value });

describe('readPath', () => {
  it('reads nested keys and returns undefined for missing segments', () => {
    expect(readPath(payload, 'customer.wilaya')).toBe('16');
    expect(readPath(payload, 'customer.missing.deep')).toBeUndefined();
    expect(readPath(payload, 'method.length')).toBeUndefined();
    expect(readPath(null, 'a')).toBeUndefined();
  });
});

describe('matchesCondition', () => {
  it('compares strings with eq and neq', () => {
    expect(matchesCondition(payload, c('method', 'eq', 'cash'))).toBe(true);
    expect(matchesCondition(payload, c('method', 'eq', 'cib'))).toBe(false);
    expect(matchesCondition(payload, c('method', 'neq', 'cib'))).toBe(true);
  });

  it('compares booleans by their text form', () => {
    expect(matchesCondition(payload, c('customer.vip', 'eq', 'true'))).toBe(true);
  });

  it('compares decimal-string amounts numerically', () => {
    expect(matchesCondition(payload, c('totalCents', 'gt', '100000'))).toBe(true);
    expect(matchesCondition(payload, c('totalCents', 'gt', '250000'))).toBe(false);
    expect(matchesCondition(payload, c('totalCents', 'gte', '250000'))).toBe(true);
    expect(matchesCondition(payload, c('totalCents', 'lt', '300000'))).toBe(true);
    expect(matchesCondition(payload, c('totalCents', 'lte', '249999'))).toBe(false);
  });

  it('never matches a missing, null or object field, even for neq', () => {
    expect(matchesCondition(payload, c('absent', 'neq', 'x'))).toBe(false);
    expect(matchesCondition(payload, c('lines', 'eq', '[object Object]'))).toBe(false);
    expect(matchesCondition(payload, c('lines.0.productId', 'neq', 'x'))).toBe(false);
  });

  it('does not match ordering operators on non-numeric values', () => {
    expect(matchesCondition(payload, c('method', 'gt', '5'))).toBe(false);
  });
});

describe('matchesConditions', () => {
  it('requires every condition, and an empty list matches everything', () => {
    expect(matchesConditions(payload, [])).toBe(true);
    expect(matchesConditions(payload, [c('method', 'eq', 'cash'), c('totalCents', 'gt', '1')])).toBe(true);
    expect(matchesConditions(payload, [c('method', 'eq', 'cash'), c('totalCents', 'gt', '999999')])).toBe(false);
  });
});

describe('conditionsSchema', () => {
  it('accepts valid conditions and rejects bad field paths and operators', () => {
    expect(conditionsSchema.safeParse([c('totalCents', 'gt', '0')]).success).toBe(true);
    expect(conditionsSchema.safeParse([{ field: 'a; drop', op: 'eq', value: '' }]).success).toBe(false);
    expect(conditionsSchema.safeParse([{ field: 'a', op: 'like', value: '' }]).success).toBe(false);
  });
});
