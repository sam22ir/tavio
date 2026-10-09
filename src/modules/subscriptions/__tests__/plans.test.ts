import { describe, expect, it } from 'vitest';
import { SAAS_PLAN_SEED, isModuleAllowed, monthlyTotalCents, seatsWithinPlan } from '../plans';

const plan = (code: string) => {
  const p = SAAS_PLAN_SEED.find((x) => x.code === code);
  if (!p) throw new Error(`missing plan ${code}`);
  return p;
};

describe('SAAS_PLAN_SEED', () => {
  it('has Free with one user and the core, contacts and credit_sales modules', () => {
    const free = plan('free');
    expect(free.maxUsers).toBe(1);
    expect(free.modules).toEqual(['core', 'contacts', 'credit_sales']);
    expect(free.pricePerUserCents).toBe(0n);
  });

  it('has unique codes and every paid plan costs more than Free', () => {
    const codes = SAAS_PLAN_SEED.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(plan('pro').pricePerUserCents).toBeGreaterThan(0n);
    expect(plan('business').pricePerUserCents).toBeGreaterThan(plan('pro').pricePerUserCents);
  });
});

describe('isModuleAllowed', () => {
  it('allows modules listed by the plan and denies the rest', () => {
    expect(isModuleAllowed(plan('free'), 'contacts')).toBe(true);
    expect(isModuleAllowed(plan('free'), 'invoicing')).toBe(false);
    expect(isModuleAllowed(plan('pro'), 'invoicing')).toBe(true);
    expect(isModuleAllowed(plan('pro'), 'hr')).toBe(false);
    expect(isModuleAllowed(plan('business'), 'hr')).toBe(true);
  });

  it('denies unknown module ids', () => {
    expect(isModuleAllowed(plan('business'), 'does_not_exist')).toBe(false);
  });
});

describe('seats and price', () => {
  it('checks seats against the plan limit', () => {
    expect(seatsWithinPlan(plan('free'), 1)).toBe(true);
    expect(seatsWithinPlan(plan('free'), 2)).toBe(false);
    expect(seatsWithinPlan(plan('pro'), 0)).toBe(false);
    expect(seatsWithinPlan(plan('pro'), 1.5)).toBe(false);
  });

  it('multiplies the per-user price by seats in bigint cents', () => {
    expect(monthlyTotalCents(plan('pro'), 3)).toBe(plan('pro').pricePerUserCents * 3n);
  });
});
