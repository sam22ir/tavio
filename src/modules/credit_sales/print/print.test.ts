import { describe, expect, it } from 'vitest';
import { buildContractHtml } from './contract-html';
import { buildReceiptHtml } from './receipt-html';
import { formatDzd } from '@/core/money';

const company = { legalName: 'Maison <Test> & Fils', nif: '000123456789012', rc: '16/00-1234567B12', address: 'Alger' };
const partner = { name: 'Client Ali', phone: '0550000000' };

describe('buildReceiptHtml', () => {
  const base = {
    number: 'REC-2026-0001',
    issuedAt: new Date('2026-10-01T10:00:00Z'),
    totalCents: BigInt(1234500),
    method: 'cash',
    reference: 'PAY-1',
    contractReference: 'CTR-7',
    voided: false,
    company,
    partner,
  };

  it('includes the number, DZD amount, and dir=rtl for ar', () => {
    const html = buildReceiptHtml({ ...base, locale: 'ar' });
    expect(html).toContain('REC-2026-0001');
    expect(html).toContain(formatDzd(BigInt(1234500), 'ar'));
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('Noto+Sans+Arabic');
  });

  it('uses dir=ltr for fr and escapes company names', () => {
    const html = buildReceiptHtml({ ...base, locale: 'fr' });
    expect(html).toContain('dir="ltr"');
    expect(html).toContain(formatDzd(BigInt(1234500), 'fr'));
    expect(html).toContain('Maison &lt;Test&gt; &amp; Fils');
    expect(html).toContain('needs accountant/lawyer verification');
  });

  it('marks voided receipts', () => {
    const html = buildReceiptHtml({ ...base, voided: true, locale: 'en' });
    expect(html).toContain('VOID');
  });
});

describe('buildContractHtml', () => {
  const input = {
    reference: 'CTR-7',
    startDate: '2026-11-01',
    frequency: 'monthly' as const,
    installmentsCount: 2,
    company,
    partner,
    lines: [{ description: 'Frigo <X>', quantity: '1', unitPriceCents: BigInt(50000), lineTotalCents: BigInt(50000) }],
    cashPriceCents: BigInt(50000),
    markupCents: BigInt(10000),
    totalCents: BigInt(60000),
    downPaymentCents: BigInt(10000),
    financedCents: BigInt(50000),
    schedule: [
      { seq: 1, dueDate: '2026-11-01', amountCents: BigInt(25000) },
      { seq: 2, dueDate: '2026-12-01', amountCents: BigInt(25000) },
    ],
  };

  it('renders lines, schedule, amounts and signature boxes in ar RTL', () => {
    const html = buildContractHtml({ ...input, locale: 'ar' });
    expect(html).toContain('CTR-7');
    expect(html).toContain('Frigo &lt;X&gt;');
    expect(html).toContain(formatDzd(BigInt(60000), 'ar'));
    expect(html).toContain(formatDzd(BigInt(25000), 'ar'));
    expect(html).toContain('dir="rtl"');
    expect(html.match(/class="sig"/g)?.length).toBe(1);
  });
});
