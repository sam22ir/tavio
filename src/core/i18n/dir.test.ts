import { describe, expect, it } from 'vitest';
import { dirFor } from './dir';

describe('dirFor', () => {
  it('returns rtl for Arabic', () => {
    expect(dirFor('ar')).toBe('rtl');
  });
  it('returns ltr for French and English', () => {
    expect(dirFor('fr')).toBe('ltr');
    expect(dirFor('en')).toBe('ltr');
  });
});
