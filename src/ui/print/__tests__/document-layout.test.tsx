import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DocumentLayout, type DocumentLabels } from '../document-layout';

const labels = Object.fromEntries(
  ['seller', 'buyer', 'nif', 'nis', 'rc', 'ai', 'address', 'phone', 'email', 'wilaya', 'number', 'date', 'dueDate', 'description', 'qty', 'unit', 'discount', 'vatRate', 'vat', 'base', 'stampDuty', 'totalHt', 'totalTtc', 'totalInWords', 'paid', 'balance', 'page', 'legal', 'verify'].map((k) => [k, k]),
) as DocumentLabels;

function render(overrides: Partial<Parameters<typeof DocumentLayout>[0]> = {}): string {
  return renderToStaticMarkup(
    <DocumentLayout
      locale="fr"
      labels={labels}
      title="Facture"
      number="FAC-1"
      date="2026-10-09"
      company={{ legalName: 'Acme SARL', address: 'Alger', wilaya: '16', phone: null, email: null, nif: '000111', nis: null, rc: null, ai: null }}
      party={{ name: 'Client <X>', nif: '999' }}
      partyRole="buyer"
      lines={[{ description: 'Riz', quantity: '2', unitPriceCents: BigInt(20000), discountRate: '0', ratePercent: '9', subtotalCents: BigInt(40000), taxCents: BigInt(3600) }]}
      totals={{ untaxedCents: BigInt(40000), taxCents: BigInt(3600), totalCents: BigInt(43600) }}
      {...overrides}
    />,
  );
}

describe('DocumentLayout', () => {
  it('renders identity, escaped party name, VAT by rate and amount in words', () => {
    const html = render();
    expect(html).toContain('Acme SARL');
    expect(html).toContain('000111');
    expect(html).toContain('Client &lt;X&gt;');
    expect(html).toContain('9%');
    expect(html).toContain('quatre cent trente-six');
    expect(html).toContain('verify');
    expect(html).toContain('dir="ltr"');
  });

  it('shows discount column only when a line is discounted, and payments only when present', () => {
    expect(render().includes('Remise') || render().includes('discount')).toBe(false);
    const paid = render({ totals: { untaxedCents: BigInt(40000), taxCents: BigInt(3600), totalCents: BigInt(43600), paidCents: BigInt(10000) } });
    expect(paid).toContain('balance');
    expect(paid).toContain('paid');
  });

  it('uses RTL direction for ar', () => {
    expect(render({ locale: 'ar' })).toContain('dir="rtl"');
  });
});
