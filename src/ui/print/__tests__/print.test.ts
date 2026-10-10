import { describe, expect, it } from 'vitest';
import { amountInWords } from '@/core/money/words';
import { groupVatByRate } from '../vat';

const c = (dinars: number, centimes = 0) => BigInt(dinars * 100 + centimes);

describe('amountInWords (fr/ar)', () => {
  it.each([
    [0, 0, 'fr', 'zéro dinar algérien et zéro centime'],
    [1, 0, 'fr', 'un dinar algérien et zéro centime'],
    [21, 0, 'fr', 'vingt et un dinars algériens et zéro centime'],
    [80, 0, 'fr', 'quatre-vingts dinars algériens et zéro centime'],
    [1000, 0, 'fr', 'mille dinars algériens et zéro centime'],
    [1_000_000, 0, 'fr', 'un million de dinars algériens et zéro centime'],
    [1000, 50, 'fr', 'mille dinars algériens et cinquante centimes'],
    [0, 0, 'ar', 'صفر دينار جزائري وصفر سنتيم'],
    [21, 0, 'ar', 'أحد وعشرون دينار جزائري وصفر سنتيم'],
    [1000, 0, 'ar', 'ألف دينار جزائري وصفر سنتيم'],
    [1_000_000, 0, 'ar', 'مليون دينار جزائري وصفر سنتيم'],
  ] as const)('%i DA %i centimes (%s)', (dinars, centimes, locale, expected) => {
    expect(amountInWords(c(dinars, centimes), locale)).toBe(expected);
  });
});

describe('groupVatByRate', () => {
  it('sums base and tax per rate, sorted ascending, and merges numeric-equal rates', () => {
    const groups = groupVatByRate([
      { ratePercent: '19', baseCents: c(100), taxCents: c(19) },
      { ratePercent: '9', baseCents: c(50), taxCents: c(4, 50) },
      { ratePercent: '19.00', baseCents: c(20), taxCents: c(3, 80) },
    ]);
    expect(groups).toEqual([
      { ratePercent: '9', baseCents: c(50), taxCents: c(4, 50) },
      { ratePercent: '19', baseCents: c(120), taxCents: c(22, 80) },
    ]);
  });

  it('returns no groups for no lines', () => {
    expect(groupVatByRate([])).toEqual([]);
  });
});
