import { describe, expect, it } from 'vitest';
import { leadInput, leadUpdateInput } from '../service/leads';

describe('leadInput', () => {
  it('accepts a minimal lead and turns blank optional fields into absent values', () => {
    const r = leadInput.safeParse({ name: '  Achat frigo, Oran  ', phone: '', partnerId: '', priority: '1' });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.name).toBe('Achat frigo, Oran');
    expect(r.data.phone).toBeUndefined();
    expect(r.data.partnerId).toBeUndefined();
    expect(r.data.priority).toBe(1);
    expect(r.data.type).toBe('lead');
  });

  it('rejects an empty name, an unknown source and a wilaya outside 01-58', () => {
    expect(leadInput.safeParse({ name: '' }).success).toBe(false);
    expect(leadInput.safeParse({ name: 'x', source: 'tv' }).success).toBe(false);
    expect(leadInput.safeParse({ name: 'x', wilayaCode: '59' }).success).toBe(false);
    expect(leadInput.safeParse({ name: 'x', wilayaCode: '16' }).success).toBe(true);
  });

  it('rejects a negative expected revenue and a probability above 100', () => {
    expect(leadInput.safeParse({ name: 'x', expectedRevenueCents: BigInt(-1) }).success).toBe(false);
    expect(leadInput.safeParse({ name: 'x', probability: 101 }).success).toBe(false);
  });

  it('update input never accepts stageId, which only moveLead may change', () => {
    const r = leadUpdateInput.safeParse({ stageId: '4f8e2f2a-0000-4000-8000-000000000000', name: 'x' });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect('stageId' in r.data).toBe(false);
  });
});
