import type { Locale } from '@/core/ctx';
import { formatDzd, type Cents } from '@/core/money';
import { amountInWords } from '@/core/money/words';

export interface PrintLabels {
  title: string; seller: string; buyer: string; nif: string; nis: string; rc: string; ai: string; address: string;
  number: string; date: string; description: string; qty: string; unit: string; amount: string;
  vatRate: string; vat: string; stampDuty: string; totalInWords: string; print: string;
}

export interface PrintParty { name: string; nif?: string | null; nis?: string | null; rc?: string | null; ai?: string | null; address?: string | null }
export interface PrintLine { description: string; quantity: string; unitPriceCents: Cents; subtotalCents: Cents; ratePercent: string }

export interface InvoicePrintInput {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  labels: PrintLabels;
  documentTitle: string;
  number: string;
  date: string;
  seller: PrintParty;
  buyer: PrintParty;
  lines: PrintLine[];
  taxGroups: { ratePercent: string; taxCents: Cents }[];
  untaxedCents: Cents;
  taxCents: Cents;
  stampCents: Cents;
  totalCents: Cents;
}

/** Escapes text for HTML. Every interpolated value passes through this. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/**
 * Printable A4 invoice (HTML). Shows Algerian legal identifiers and VAT per rate.
 * ⚠ needs accountant verification: the mandatory mentions must be confirmed by an accountant.
 */
export function buildInvoicePrintHtml(input: InvoicePrintInput): string {
  const e = escapeHtml;
  const l = input.labels;
  const money = (c: Cents) => formatDzd(c, input.locale);
  const ids = (p: PrintParty) =>
    [
      p.nif && `${l.nif}: ${p.nif}`,
      p.nis && `${l.nis}: ${p.nis}`,
      p.rc && `${l.rc}: ${p.rc}`,
      p.ai && `${l.ai}: ${p.ai}`,
    ]
      .filter(Boolean)
      .map((s) => `<div>${e(String(s))}</div>`)
      .join('');
  const party = (title: string, p: PrintParty) =>
    `<section class="party"><h3>${e(title)}</h3><div class="name">${e(p.name)}</div>${p.address ? `<div>${e(p.address)}</div>` : ''}${ids(p)}</section>`;
  const rows = input.lines
    .map(
      (line) => `<tr><td>${e(line.description)}</td><td class="n">${e(line.quantity)}</td><td class="n">${money(line.unitPriceCents)}</td><td class="n">${money(line.subtotalCents)}</td><td class="n">${e(line.ratePercent)}%</td></tr>`,
    )
    .join('');
  const vat = input.taxGroups
    .map((g) => `<tr><td>${l.vat} ${e(g.ratePercent)}%</td><td class="n">${money(g.taxCents)}</td></tr>`)
    .join('');
  return `<!-- ⚠ needs accountant verification -->
<!doctype html>
<html lang="${input.locale}" dir="${input.dir}"><head><meta charset="utf-8"><title>${e(input.documentTitle)} ${e(input.number)}</title>
<style>
body{font-family:Arial,sans-serif;color:#111;margin:24px;font-size:12px}
h1{font-size:18px;margin:0 0 8px}h3{font-size:12px;margin:0 0 4px;color:#555}
.head{display:flex;justify-content:space-between;gap:16px;margin-bottom:16px}
.parties{display:flex;justify-content:space-between;gap:16px;margin-bottom:16px}
.party{flex:1;border:1px solid #ccc;padding:8px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{border-bottom:1px solid #ddd;padding:6px;text-align:start}
td.n,th.n{text-align:end}
.totals{margin-top:12px;margin-inline-start:auto;width:55%}
.totals td{border:0}
.grand{font-weight:bold;font-size:14px}
@media print{button{display:none}}
</style></head>
<body>
<div class="head"><div><h1>${e(input.documentTitle)}</h1><div>${l.number} ${e(input.number)}</div><div>${l.date}: ${e(input.date)}</div></div></div>
<div class="parties">${party(l.seller, input.seller)}${party(l.buyer, input.buyer)}</div>
<table><thead><tr><th>${l.description}</th><th class="n">${l.qty}</th><th class="n">${l.unit}</th><th class="n">${l.amount}</th><th class="n">${l.vatRate}</th></tr></thead><tbody>${rows}</tbody></table>
<table class="totals">
<tr><td>${l.amount}</td><td class="n">${money(input.untaxedCents)}</td></tr>
${vat}
${input.stampCents > BigInt(0) ? `<tr><td>${l.stampDuty}</td><td class="n">${money(input.stampCents)}</td></tr>` : ''}
<tr class="grand"><td>${l.totalInWords} : ${e(amountInWords(input.totalCents, input.locale))}</td><td class="n">${money(input.totalCents)}</td></tr>
</table>
</body></html>`;
}
