import { describe, expect, it } from 'vitest';
import { autoMapColumns, mapRecord } from '@/core/io';
import { IMPORT_ENTITY_NAMES, IMPORT_TARGETS, importFieldsFor, importTemplateRows, toIsoDate } from './targets';

function parseWith(name: (typeof IMPORT_ENTITY_NAMES)[number], headers: string[], record: string[]) {
  const target = IMPORT_TARGETS[name];
  const fields = importFieldsFor(target, 'fr');
  const mapping = autoMapColumns(headers, fields);
  return target.parse(mapRecord(record, mapping), 'fr');
}

describe('import targets: registry', () => {
  it.each(IMPORT_ENTITY_NAMES)('%s has a write permission, French template rows and matching field counts', (name) => {
    const target = IMPORT_TARGETS[name];
    expect(target.writePerm).toMatch(/^[a-z_]+\.[a-z_]+\.write$/);
    const { header, example } = importTemplateRows(target);
    expect(header).toHaveLength(target.fieldKeys.length);
    expect(example).toHaveLength(target.fieldKeys.length);
    expect(header.every((h) => h.length > 0 && !h.startsWith('io.import.'))).toBe(true);
  });
});

describe('opening stock', () => {
  const headers = ['Code produit (SKU)', 'Code dépôt', 'Quantité', 'Coût unitaire (DZD)'];

  it('maps French headers and reads quantity with a decimal comma and unit cost in DZD', () => {
    const parsed = parseWith('inventory.opening_stock', headers, ['CIM-001', 'WH', '12,5', '1500,50']);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toMatchObject({ productCode: 'CIM-001', warehouseCode: 'WH', quantity: '12.5', unitCost: BigInt(150050) });
    }
  });

  it('accepts a blank warehouse (default warehouse) and rejects zero quantity and bad cost', () => {
    const ok = parseWith('inventory.opening_stock', headers, ['CIM-001', '', '3', '10']);
    expect(ok.ok).toBe(true);
    const zero = parseWith('inventory.opening_stock', headers, ['CIM-001', '', '0', '10']);
    expect(zero.ok).toBe(false);
    const badCost = parseWith('inventory.opening_stock', headers, ['CIM-001', '', '3', 'abc']);
    expect(badCost.ok).toBe(false);
    if (!badCost.ok) expect(badCost.issues.some((i) => i.field === 'unitCost')).toBe(true);
  });
});

describe('chart of accounts', () => {
  const headers = ['Code compte', 'Libellé', 'Compte parent', 'Type'];

  it('maps French type words and checks the parent against the code prefix', () => {
    const ok = parseWith('accounting.chart_account', headers, ['5121', 'Banque', '51', 'Actif']);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value).toMatchObject({ code: '5121', label: 'Banque', type: 'asset' });
    const wrongParent = parseWith('accounting.chart_account', headers, ['5121', 'Banque', '40', 'Actif']);
    expect(wrongParent.ok).toBe(false);
    const unknownType = parseWith('accounting.chart_account', headers, ['5121', 'Banque', '51', 'Inconnu']);
    expect(unknownType.ok).toBe(false);
  });

  it('rejects codes that are not 2 to 8 digits', () => {
    const bad = parseWith('accounting.chart_account', headers, ['A1', 'Banque', '', 'Actif']);
    expect(bad.ok).toBe(false);
  });
});

describe('opening balances', () => {
  const headers = ['Code compte', 'Partenaire', 'Débit (DZD)', 'Crédit (DZD)'];

  it('accepts one side per line and refuses both or neither', () => {
    expect(parseWith('accounting.opening_balance', headers, ['512', '', '1500,00', '']).ok).toBe(true);
    expect(parseWith('accounting.opening_balance', headers, ['101', '', '', '1500,00']).ok).toBe(true);
    const both = parseWith('accounting.opening_balance', headers, ['512', '', '10', '10']);
    expect(both.ok).toBe(false);
    const neither = parseWith('accounting.opening_balance', headers, ['512', '', '', '']);
    expect(neither.ok).toBe(false);
  });
});

describe('sales quotes', () => {
  const headers = ['Réf. devis', 'Client (nom, téléphone ou NIF)', 'Code produit (SKU)', 'Quantité', 'Prix unitaire (DZD)', 'Remise (%)', 'Date'];

  it('reads dd/mm/yyyy dates and percentage discounts', () => {
    const parsed = parseWith('sales.quote', headers, ['DEV-1', 'Ali', 'CIM-001', '2', '1800,00', '5', '10/10/2026']);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value).toMatchObject({ orderRef: 'DEV-1', date: '2026-10-10', discount: '5' });
  });

  it('rejects an impossible date', () => {
    expect(toIsoDate('31/02/2026')).toBeNull();
    expect(toIsoDate('2026-10-10')).toBe('2026-10-10');
    expect(parseWith('sales.quote', headers, ['DEV-1', 'Ali', 'CIM-001', '2', '1800', '5', '31/02/2026']).ok).toBe(false);
  });
});

describe('contacts role flags', () => {
  it('map from columns named Client and Fournisseur', () => {
    const fields = importFieldsFor(IMPORT_TARGETS['contacts.partner'], 'fr');
    const label = (key: string): string => fields.find((f) => f.key === key)?.label ?? key;
    const headers = ['Type', label('firstName'), label('lastName'), 'Client', 'Fournisseur'];
    const mapping = autoMapColumns(headers, fields);
    expect(mapping.isCustomer).toBe(3);
    expect(mapping.isSupplier).toBe(4);
    const parsed = IMPORT_TARGETS['contacts.partner'].parse(
      mapRecord(['Personne physique', 'Ali', 'Benali', 'oui', 'non'], mapping), 'fr',
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value).toMatchObject({ isCustomer: true, isSupplier: false });
  });
});
