import { describe, expect, it } from 'vitest';
import { amountInWords } from './words';

// Cents for a DA amount, with optional centimes.
const da = (dinars: number, centimes = 0) => BigInt(dinars) * BigInt(100) + BigInt(centimes);

describe('amountInWords fr', () => {
  const cases: [number, number, string][] = [
    [0, 0, 'zéro dinar algérien et zéro centime'],
    [1, 0, 'un dinar algérien et zéro centime'],
    [21, 0, 'vingt et un dinars algériens et zéro centime'],
    [71, 0, 'soixante et onze dinars algériens et zéro centime'],
    [80, 0, 'quatre-vingts dinars algériens et zéro centime'],
    [81, 0, 'quatre-vingt-un dinars algériens et zéro centime'],
    [100, 0, 'cent dinars algériens et zéro centime'],
    [200, 0, 'deux cents dinars algériens et zéro centime'],
    [201, 0, 'deux cent un dinars algériens et zéro centime'],
    [1000, 0, 'mille dinars algériens et zéro centime'],
    [2000, 0, 'deux mille dinars algériens et zéro centime'],
    [1_000_000, 0, 'un million de dinars algériens et zéro centime'],
    [77_350, 50, 'soixante-dix-sept mille trois cent cinquante dinars algériens et cinquante centimes'],
  ];
  it.each(cases)('%i DA %i centimes', (dinars, centimes, expected) => {
    expect(amountInWords(da(dinars, centimes), 'fr')).toBe(expected);
  });

  it('handles singular centime and mixed compounds', () => {
    expect(amountInWords(da(1, 1), 'fr')).toBe('un dinar algérien et un centime');
    expect(amountInWords(da(21_000), 'fr')).toBe('vingt et un mille dinars algériens et zéro centime');
    expect(amountInWords(da(80_000), 'fr')).toBe('quatre-vingt mille dinars algériens et zéro centime');
    expect(amountInWords(da(200_000), 'fr')).toBe('deux cent mille dinars algériens et zéro centime');
    expect(amountInWords(da(1_000_021), 'fr')).toBe('un million vingt et un dinars algériens et zéro centime');
    expect(amountInWords(da(2_000_000_000), 'fr')).toBe('deux milliards de dinars algériens et zéro centime');
  });

  it('rejects negative amounts', () => {
    expect(() => amountInWords(BigInt(-1), 'fr')).toThrow(RangeError);
  });
});

describe('amountInWords ar', () => {
  it('writes MSA numbers with the dinar unit', () => {
    expect(amountInWords(da(0), 'ar')).toBe('صفر دينار جزائري وصفر سنتيم');
    expect(amountInWords(da(21), 'ar')).toBe('أحد وعشرون دينار جزائري وصفر سنتيم');
    expect(amountInWords(da(200), 'ar')).toBe('مائتان دينار جزائري وصفر سنتيم');
    expect(amountInWords(da(1000), 'ar')).toBe('ألف دينار جزائري وصفر سنتيم');
    expect(amountInWords(da(3000), 'ar')).toBe('ثلاثة آلاف دينار جزائري وصفر سنتيم');
    expect(amountInWords(da(77_350, 50), 'ar')).toBe(
      'سبعة وسبعون ألفاً وثلاثمائة وخمسون دينار جزائري وخمسون سنتيم',
    );
    expect(amountInWords(da(1_000_000), 'ar')).toBe('مليون دينار جزائري وصفر سنتيم');
  });
});

describe('amountInWords en', () => {
  it('writes English words for the same amounts', () => {
    expect(amountInWords(da(77_350, 50), 'en')).toBe(
      'seventy-seven thousand three hundred and fifty Algerian dinars and fifty cents',
    );
    expect(amountInWords(da(1), 'en')).toBe('one Algerian dinar and zero cents');
  });
});
