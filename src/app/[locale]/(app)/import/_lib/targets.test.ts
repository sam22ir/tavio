import { describe, expect, it } from 'vitest';
import { autoMapColumns, mapRecord } from '@/core/io';
import { IMPORT_TARGETS, importFieldsFor } from './targets';

describe('import targets', () => {
  const partner = IMPORT_TARGETS['contacts.partner'];
  const product = IMPORT_TARGETS['products.product'];

  it('maps French headers and validates a valid contact row', () => {
    const fields = importFieldsFor(partner, 'fr');
    const headers = ['Type', 'Prénom', 'Nom', 'Téléphone', 'Client'];
    const mapping = autoMapColumns(headers, fields);
    expect(mapping.kind).toBe(0);
    expect(mapping.firstName).toBe(1);
    const raw = mapRecord(['Personne physique', 'Ali', 'Benali', '0550 12 34 56', 'oui'], {
      ...Object.fromEntries(fields.map((f) => [f.key, null])),
      kind: 0,
      firstName: 1,
      lastName: 2,
      phone: 3,
      isCustomer: 4,
    });
    const parsed = partner.parse(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.keys).toEqual(['phone:+213550123456']);
  });

  it('reports field issues for an invalid contact row', () => {
    const parsed = partner.parse({ kind: 'individual', firstName: '', lastName: 'Benali', isCustomer: 'true' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.issues.length).toBeGreaterThan(0);
  });

  it('defaults product active to true and derives a SKU key', () => {
    const parsed = product.parse({
      name: 'Ciment', kind: 'goods', sku: 'CIM-1', salePriceCents: '1500.50', costCents: '1200', active: '',
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.keys).toEqual(['sku:CIM-1']);
  });
});
