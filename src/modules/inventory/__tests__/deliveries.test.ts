import { describe, expect, it } from 'vitest';
import { requireSignedByName, SIGNED_BY_NAME_MAX } from '../service/deliveries';

describe('requireSignedByName', () => {
  it('rejects a missing name', () => {
    const r = requireSignedByName(null);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('VALIDATION');
      expect(r.error.message).toContain('signed_by_name is required');
      expect(r.error.details?.reason).toBe('signed_by_required');
    }
  });

  it('rejects an empty or whitespace-only name', () => {
    expect(requireSignedByName('').ok).toBe(false);
    expect(requireSignedByName('   ').ok).toBe(false);
    expect(requireSignedByName(undefined).ok).toBe(false);
  });

  it('accepts a name and returns it trimmed', () => {
    const r = requireSignedByName('  Amina Benali ');
    expect(r).toEqual({ ok: true, value: 'Amina Benali' });
  });

  it('rejects a name longer than the maximum', () => {
    const r = requireSignedByName('a'.repeat(SIGNED_BY_NAME_MAX + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('too long');
  });
});
