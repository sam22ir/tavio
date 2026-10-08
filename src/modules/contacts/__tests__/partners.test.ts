import { describe, expect, it } from 'vitest';
import { centsToDzdInput, normalizePartner, normalizePhone, partnerInput, type PartnerInput } from '../service/partners';

const base: PartnerInput = {
  kind: 'individual',
  isCustomer: true,
  isSupplier: false,
  isProspect: false,
  firstName: 'Amina',
  lastName: 'Benali',
  phone: '0555 12 34 56',
  companyName: undefined,
  nif: undefined,
  nis: undefined,
  rc: undefined,
  ai: undefined,
  phoneAlt: undefined,
  email: undefined,
  address: undefined,
  wilayaCode: undefined,
  commune: undefined,
  employer: undefined,
  monthlyIncomeCents: undefined,
  notes: undefined,
};

describe('normalizePhone', () => {
  it.each([
    ['0555123456', '+213555123456'],
    ['0555 12 34 56', '+213555123456'],
    ['+213 555-12-34-56', '+213555123456'],
    ['00213555123456', '+213555123456'],
  ])('normalizes %s', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it.each(['12345', 'abc', '+0123456789', '05551'])('rejects %s', (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});

describe('normalizePartner', () => {
  it('builds the display name and E.164 phone for an individual', () => {
    const r = normalizePartner(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.displayName).toBe('Amina Benali');
    expect(r.value.phone).toBe('+213555123456');
    expect(r.value.companyName).toBeNull();
    expect(r.value.monthlyIncomeCents).toBeNull();
  });

  it('uses the company name as display name for companies', () => {
    const r = normalizePartner({
      ...base,
      kind: 'company',
      firstName: undefined,
      lastName: undefined,
      companyName: 'Sarl Tavio',
    });
    expect(r.ok && r.value.displayName).toBe('Sarl Tavio');
    expect(r.ok && r.value.firstName).toBeNull();
  });

  it('requires at least one role', () => {
    const r = normalizePartner({ ...base, isCustomer: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('VALIDATION');
  });

  it('requires names for individuals and a company name for companies', () => {
    expect(normalizePartner({ ...base, lastName: undefined }).ok).toBe(false);
    expect(normalizePartner({ ...base, kind: 'company', firstName: undefined, lastName: undefined }).ok).toBe(false);
  });

  it('parses monthly income as DZD into bigint cents', () => {
    const r = normalizePartner({ ...base, monthlyIncomeCents: '1 234,50' });
    expect(r.ok && r.value.monthlyIncomeCents).toBe(BigInt(123450));
  });

  it('rejects an invalid income and an invalid phone', () => {
    expect(normalizePartner({ ...base, monthlyIncomeCents: 'abc' }).ok).toBe(false);
    expect(normalizePartner({ ...base, phone: '123' }).ok).toBe(false);
  });
});

describe('partnerInput', () => {
  it('reads checkbox values from form-style input', () => {
    const parsed = partnerInput.safeParse({
      kind: 'individual',
      isCustomer: 'on',
      firstName: '  Yacine ',
      lastName: 'K',
      wilayaCode: '16',
      email: '',
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.isCustomer).toBe(true);
    expect(parsed.data.isSupplier).toBe(false);
    expect(parsed.data.firstName).toBe('Yacine');
    expect(parsed.data.email).toBeUndefined();
  });

  it('rejects wilaya codes outside 01 to 58', () => {
    expect(partnerInput.safeParse({ kind: 'company', wilayaCode: '59' }).success).toBe(false);
  });
});

describe('centsToDzdInput', () => {
  it('formats cents as a DZD string', () => {
    expect(centsToDzdInput('123450')).toBe('1234.50');
    expect(centsToDzdInput('5')).toBe('0.05');
    expect(centsToDzdInput(null)).toBeUndefined();
  });
});
