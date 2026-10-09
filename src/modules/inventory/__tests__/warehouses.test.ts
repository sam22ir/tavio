import { describe, expect, it } from 'vitest';
import { normalizeWarehouse } from '../service/warehouses';

describe('normalizeWarehouse', () => {
  it('upper-cases the code and trims the name', () => {
    const r = normalizeWarehouse({ code: ' wh-north ', name: '  North  ' });
    expect(r).toEqual({ ok: true, value: { code: 'WH-NORTH', name: 'North', wilayaCode: undefined } });
  });

  it('accepts a valid wilaya code and rejects an unknown one', () => {
    expect(normalizeWarehouse({ code: 'A', name: 'A', wilayaCode: '16' }).ok).toBe(true);
    const bad = normalizeWarehouse({ code: 'A', name: 'A', wilayaCode: '59' });
    expect(bad.ok).toBe(false);
  });

  it('rejects empty names and malformed codes', () => {
    expect(normalizeWarehouse({ code: 'A', name: '   ' }).ok).toBe(false);
    expect(normalizeWarehouse({ code: 'BAD CODE!', name: 'x' }).ok).toBe(false);
  });
});
