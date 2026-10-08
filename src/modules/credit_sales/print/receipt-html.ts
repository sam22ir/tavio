import type { Locale } from '@/core/ctx';
import { type CompanyPrint, type PartnerPrint, dirFor, escapeHtml, formatDate, labels, money } from './shared';
import { FONT_LINK, PRINT_CSS } from './print-styles';

export interface ReceiptPrintInput {
  locale: Locale;
  number: string;
  issuedAt: Date;
  totalCents: bigint;
  method: string;
  reference: string;
  contractReference: string | null;
  voided: boolean;
  company: CompanyPrint;
  partner: PartnerPrint;
}

/** Pure: returns a full A5 receipt document. Amounts are bigint cents, formatted in DZD. */
export function buildReceiptHtml(input: ReceiptPrintInput): string {
  const t = labels(input.locale);
  const { company, partner } = input;
  const e = escapeHtml;

  return `<!doctype html>
<html lang="${input.locale}" dir="${dirFor(input.locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(t.receipt)} ${e(input.number)}</title>
${FONT_LINK}
<style>${PRINT_CSS}</style>
</head>
<body>
<div class="receipt">
  <div class="head">
    <div>
      <h1>${e(company.legalName)}</h1>
      <!-- ⚠ needs accountant/lawyer verification -->
      <div class="muted">${e(t.nif)}: ${e(company.nif ?? '—')} · ${e(t.rc)}: ${e(company.rc ?? '—')}</div>
      <div class="muted">${e(t.address)}: ${e(company.address ?? '—')}</div>
    </div>
    <div style="text-align:end">
      <div><strong>${e(t.receipt)}</strong></div>
      <div>${e(t.number)} ${e(input.number)}</div>
      <div>${e(t.issuedAt)}: ${e(formatDate(input.issuedAt, input.locale))}</div>
      ${input.voided ? `<div class="void">${e(t.voided)}</div>` : ''}
    </div>
  </div>

  <div><strong>${e(t.client)}:</strong> ${e(partner.name)}</div>
  <div class="muted">${e(t.phone)}: ${e(partner.phone ?? '—')}</div>

  <table style="margin-top:12px">
    <tbody>
      <tr><th>${e(t.method)}</th><td>${e(input.method)}</td></tr>
      <tr><th>${e(t.reference)}</th><td>${e(input.reference)}</td></tr>
      ${input.contractReference ? `<tr><th>${e(t.contract)}</th><td>${e(input.contractReference)}</td></tr>` : ''}
    </tbody>
  </table>

  <div class="box" style="margin-top:14px;display:flex;justify-content:space-between;font-size:15px">
    <strong>${e(t.total)}</strong>
    <strong>${e(money(input.totalCents, input.locale))}</strong>
  </div>

  <!-- ⚠ needs accountant/lawyer verification -->
  <div class="sig">
    <div>${e(t.signature)}</div>
  </div>
</div>
</body>
</html>`;
}
