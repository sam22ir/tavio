import { describe, expect, it } from 'vitest';
import { digitsOnly, normalizeCode, normalizeName, normalizeText, toLatinDigits } from '../normalize';

describe('digits', () => {
  it('converts Arabic-Indic and Persian digits to ASCII', () => {
    expect(toLatinDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(toLatinDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
  });

  it('keeps only digits, after conversion', () => {
    expect(digitsOnly('NIF: 000 123-456 789 012')).toBe('000123456789012');
    expect(digitsOnly('٠٠٠ ١٢٣')).toBe('000123');
  });
});

describe('normalizeText', () => {
  it('lowercases, strips Latin accents and collapses spaces', () => {
    expect(normalizeText('  Société   Générale ')).toBe('societe generale');
  });

  it('strips Arabic diacritics and tatweel', () => {
    expect(normalizeText('شَرِكَة ـــ أطلس')).toBe('شركة اطلس');
  });
});

describe('normalizeName', () => {
  it('drops Latin legal suffixes', () => {
    expect(normalizeName('SARL Atlas')).toBe('atlas');
    expect(normalizeName('Atlas S.A.R.L.')).toBe('atlas');
    expect(normalizeName('Ets Bouzid EURL')).toBe('ets bouzid');
    expect(normalizeName('Société Oran SPA')).toBe('oran');
  });

  it('drops Arabic legal forms', () => {
    expect(normalizeName('شركة أطلس')).toBe('اطلس');
    expect(normalizeName('أطلس ش.ذ.م.م')).toBe('اطلس');
  });

  it('treats equal names with different punctuation and suffixes as equal', () => {
    expect(normalizeName('Bouzid & Fils SARL')).toBe('bouzid fils');
    expect(normalizeName('Bouzid - Fils')).toBe(normalizeName('bouzid fils'));
  });
});

describe('normalizeCode', () => {
  it('keeps only letters and digits, lowercase', () => {
    expect(normalizeCode('FAC-2026 / 0007')).toBe('fac20260007');
    expect(normalizeCode('٠١٦-٠٠١')).toBe('016001');
  });
});
