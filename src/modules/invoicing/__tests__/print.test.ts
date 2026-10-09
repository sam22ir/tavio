import { describe, expect, it } from 'vitest';
import { buildInvoicePrintHtml, escapeHtml, type PrintLabels } from '../service/print';

const labels: PrintLabels = {
  title: 'Facture', seller: 'Vendeur', buyer: 'Acheteur', nif: 'NIF', nis: 'NIS', rc: 'RC', ai: 'AI', address: 'Adresse',
  number: 'N°', date: 'Date', description: 'Désignation', qty: 'Qté', unit: 'P.U.', amount: 'HT', vatRate: 'Taux',
  vat: 'TVA', stampDuty: 'Timbre', totalInWords: 'Total', print: 'Imprimer',
};

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml('<b>"A" & \'B\'</b>')).toBe('&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;');
  });
});

describe('buildInvoicePrintHtml', () => {
  const html = buildInvoicePrintHtml({
    locale: 'fr',
    dir: 'ltr',
    labels,
    documentTitle: 'Facture',
    number: 'FAC-2026-00001',
    date: '2026-10-09',
    seller: { name: 'Acme <SARL>', nif: '000000000000000', nis: '1', rc: '16B0001', ai: '1', address: 'Alger' },
    buyer: { name: 'Client', nif: null },
    lines: [{ description: 'Riz', quantity: '2.000', unitPriceCents: BigInt(20000), subtotalCents: BigInt(40000), ratePercent: '9' }],
    taxGroups: [{ ratePercent: '9', taxCents: BigInt(3600) }],
    untaxedCents: BigInt(40000),
    taxCents: BigInt(3600),
    stampCents: BigInt(0),
    totalCents: BigInt(43600),
  });

  it('starts with the accountant verification marker', () => {
    expect(html.startsWith('<!-- ⚠ needs accountant verification -->')).toBe(true);
  });
  it('shows seller identifiers and escapes the seller name', () => {
    expect(html).toContain('NIF: 000000000000000');
    expect(html).toContain('Acme &lt;SARL&gt;');
  });
  it('shows VAT per rate and omits stamp duty when zero', () => {
    expect(html).toContain('TVA 9%');
    expect(html).not.toContain('Timbre');
  });
});
