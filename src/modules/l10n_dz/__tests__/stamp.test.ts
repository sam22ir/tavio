import { describe, expect, it } from 'vitest';
import { stampDutyCents } from '@/modules/invoicing/service/math';
import { DZ_STAMP_DUTY_SEED, stampTiersFromSeed, type StampTier } from '../data';

const DA = (n: number) => BigInt(n) * BigInt(100);

describe('stamp duty tiers from settings', () => {
  it('seed tiers reproduce the previous fixed amounts (0, 1, 1.5, 2 DA)', () => {
    const tiers = stampTiersFromSeed();
    expect(stampDutyCents(DA(299), tiers)).toBe(BigInt(0));
    expect(stampDutyCents(DA(300), tiers)).toBe(BigInt(100));
    expect(stampDutyCents(DA(29999), tiers)).toBe(BigInt(100));
    expect(stampDutyCents(DA(30000), tiers)).toBe(BigInt(150));
    expect(stampDutyCents(DA(99999), tiers)).toBe(BigInt(150));
    expect(stampDutyCents(DA(100000), tiers)).toBe(BigInt(200));
  });

  it('seed bounds are ascending and the last tier is unbounded', () => {
    const bounds = DZ_STAMP_DUTY_SEED.map((s) => s.upToDa);
    expect(bounds.at(-1)).toBeNull();
    const finite = bounds.slice(0, -1) as number[];
    expect([...finite].sort((a, b) => a - b)).toEqual(finite);
  });

  it('a rate tier applies to the amount, rounded to the centime', () => {
    const tiers: StampTier[] = [
      { upToDa: BigInt(1000), mode: 'rate', ratePercent: '1', fixedCents: BigInt(0) },
      { upToDa: null, mode: 'fixed', ratePercent: '0', fixedCents: BigInt(500) },
    ];
    expect(stampDutyCents(DA(999), tiers)).toBe(BigInt(999)); // 1% of 999 DA = 9.99 DA
    expect(stampDutyCents(DA(1000), tiers)).toBe(BigInt(500));
  });

  it('a custom tier list replaces the seed, and an empty list yields no duty', () => {
    const tiers: StampTier[] = [{ upToDa: null, mode: 'fixed', ratePercent: '0', fixedCents: BigInt(250) }];
    expect(stampDutyCents(DA(1), tiers)).toBe(BigInt(250));
    expect(stampDutyCents(DA(1), [])).toBe(BigInt(0));
  });
});
