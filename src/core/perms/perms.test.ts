import { describe, expect, it } from 'vitest';
import { can, OWNER_PERMS, requirePerm } from './index';

describe('can', () => {
  it('matches an exact permission string', () => {
    expect(can(new Set(['crm.lead.read']), 'crm.lead.read')).toBe(true);
    expect(can(new Set(['crm.lead.read']), 'crm.lead.write')).toBe(false);
  });

  it('grants everything with "*"', () => {
    expect(can(new Set(['*']), 'crm.lead.write')).toBe(true);
    expect(can(OWNER_PERMS, 'credit_sales.payment.post')).toBe(true);
  });

  it('matches a module prefix wildcard "crm.*"', () => {
    expect(can(new Set(['crm.*']), 'crm.lead.read')).toBe(true);
    expect(can(new Set(['crm.*']), 'crm.read')).toBe(true);
  });

  it('matches a nested prefix wildcard "crm.lead.*"', () => {
    expect(can(new Set(['crm.lead.*']), 'crm.lead.read')).toBe(true);
    expect(can(new Set(['crm.lead.*']), 'crm.lead.write')).toBe(true);
    expect(can(new Set(['crm.lead.*']), 'crm.contact.read')).toBe(false);
  });

  it('does not match a name that only shares the prefix text', () => {
    expect(can(new Set(['crm.*']), 'crmx.lead.read')).toBe(false);
    expect(can(new Set(['crm.lead.*']), 'crm.leads.read')).toBe(false);
  });

  it('denies everything for an empty set', () => {
    expect(can(new Set(), 'crm.lead.read')).toBe(false);
    expect(can(new Set(), '*')).toBe(false);
  });
});

describe('requirePerm', () => {
  it('returns ok when the permission is granted', () => {
    expect(requirePerm({ perms: new Set(['crm.*']) }, 'crm.lead.read')).toEqual({ ok: true, value: undefined });
  });

  it('returns FORBIDDEN with the permission in details when missing', () => {
    const r = requirePerm({ perms: new Set() }, 'crm.lead.read');
    expect(r).toEqual({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Missing permission crm.lead.read', details: { perm: 'crm.lead.read' } },
    });
  });
});
