import { describe, expect, it } from 'vitest';
import { normalizeGuarantor } from '../service/guarantors';

describe('normalizeGuarantor', () => {
  const base = { fullName: '  Karim Saadi ', nin: '123456789012345678' };

  it('trims and keeps optional fields as null when blank', () => {
    const out = normalizeGuarantor({ ...base, phone: ' ', address: '', relation: 'Frère' });
    expect(out).toEqual({
      ok: true,
      value: { fullName: 'Karim Saadi', nin: '123456789012345678', phone: null, address: null, relation: 'Frère' },
    });
  });

  it('rejects an empty name', () => {
    const out = normalizeGuarantor({ ...base, fullName: '   ' });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe('VALIDATION');
  });

  it('rejects a NIN with symbols or too short', () => {
    expect(normalizeGuarantor({ ...base, nin: 'AB' }).ok).toBe(false);
    expect(normalizeGuarantor({ ...base, nin: '12/34/56' }).ok).toBe(false);
  });

  it('rejects an over-long address', () => {
    expect(normalizeGuarantor({ ...base, address: 'x'.repeat(301) }).ok).toBe(false);
  });
});
