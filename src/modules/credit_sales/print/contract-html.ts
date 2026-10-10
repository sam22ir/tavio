import type { Locale } from '@/core/ctx';
import { type CompanyPrint, type PartnerPrint, dirFor, escapeHtml, formatDate, isClauseTitle, labels, money } from './shared';
import { FONT_LINK, PRINT_CSS } from './print-styles';

export interface ContractLinePrint {
  description: string;
  quantity: string;
  unitPriceCents: bigint;
  lineTotalCents: bigint;
}

export interface ScheduleLinePrint {
  seq: number;
  dueDate: string; // YYYY-MM-DD
  amountCents: bigint;
}

export interface GuarantorPrint {
  fullName: string;
  phone: string | null;
}

export interface ContractPrintInput {
  locale: Locale;
  reference: string;
  startDate: string; // YYYY-MM-DD
  frequency: 'monthly' | 'weekly';
  installmentsCount: number;
  company: CompanyPrint;
  partner: PartnerPrint;
  lines: ContractLinePrint[];
  cashPriceCents: bigint;
  markupCents: bigint;
  totalCents: bigint;
  downPaymentCents: bigint;
  financedCents: bigint;
  schedule: ScheduleLinePrint[];
  /** Clause text already rendered with the company template (see renderClauseTemplate), one entry per line. */
  clauses: string[];
  guarantors: GuarantorPrint[];
}

/** Pure: returns a full A4 contract document with lines, schedule, terms placeholder and signature boxes. */
export function buildContractHtml(input: ContractPrintInput): string {
  const t = labels(input.locale);
  const { company, partner } = input;
  const e = escapeHtml;
  const freq = input.frequency === 'weekly' ? t.weekly : t.monthly;

  const lineRows = input.lines
    .map(
      (l, i) => `<tr>
        <td>${i + 1}</td>
        <td>${e(l.description)}</td>
        <td class="num">${e(l.quantity)}</td>
        <td class="num">${e(money(l.unitPriceCents, input.locale))}</td>
        <td class="num">${e(money(l.lineTotalCents, input.locale))}</td>
      </tr>`,
    )
    .join('');

  const scheduleRows = input.schedule
    .map(
      (s) => `<tr>
        <td>${s.seq}</td>
        <td>${e(formatDate(s.dueDate, input.locale))}</td>
        <td class="num">${e(money(s.amountCents, input.locale))}</td>
      </tr>`,
    )
    .join('');

  const clauseLines = input.clauses
    .map((line) => {
      if (line.trim() === '') return '<div class="gap"></div>';
      const cls = isClauseTitle(line) ? ' class="clause-title"' : '';
      return `<p${cls}>${e(line)}</p>`;
    })
    .join('');

  const guarantorNames = input.guarantors.length === 0
    ? ''
    : input.guarantors.map((g) => `<span class="sig-name">${e(g.fullName)}${g.phone ? ` · ${e(g.phone)}` : ''}</span>`).join('');

  return `<!doctype html>
<html lang="${input.locale}" dir="${dirFor(input.locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(t.contractTitle)} ${e(input.reference)}</title>
${FONT_LINK}
<style>${PRINT_CSS}</style>
</head>
<body>
<div class="contract">
  <div class="head">
    <div>
      <h1>${e(company.legalName)}</h1>
      <!-- ⚠ needs accountant/lawyer verification -->
      <div class="muted">${e(t.nif)}: ${e(company.nif ?? '—')} · ${e(t.rc)}: ${e(company.rc ?? '—')}</div>
      <div class="muted">${e(t.address)}: ${e(company.address ?? '—')}</div>
    </div>
    <div style="text-align:end">
      <div><strong>${e(t.contractTitle)}</strong></div>
      <div>${e(t.number)} ${e(input.reference)}</div>
      <div>${e(t.startDate)}: ${e(formatDate(input.startDate, input.locale))}</div>
      <div>${e(t.frequency)}: ${e(freq)} · ${input.installmentsCount}</div>
    </div>
  </div>

  <div><strong>${e(t.client)}:</strong> ${e(partner.name)}</div>
  <div class="muted">${e(t.phone)}: ${e(partner.phone ?? '—')}</div>

  <h2>${e(t.lines)}</h2>
  <table>
    <thead>
      <tr><th>${e(t.seq)}</th><th>${e(t.description)}</th><th class="num">${e(t.quantity)}</th><th class="num">${e(t.unitPrice)}</th><th class="num">${e(t.lineTotal)}</th></tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>

  <h2>${e(t.total2)}</h2>
  <table>
    <tbody>
      <tr><th>${e(t.cashPrice)}</th><td class="num">${e(money(input.cashPriceCents, input.locale))}</td></tr>
      <tr><th>${e(t.markup)}</th><td class="num">${e(money(input.markupCents, input.locale))}</td></tr>
      <tr><th>${e(t.total2)}</th><td class="num">${e(money(input.totalCents, input.locale))}</td></tr>
      <tr><th>${e(t.downPayment)}</th><td class="num">${e(money(input.downPaymentCents, input.locale))}</td></tr>
      <tr><th>${e(t.financed)}</th><td class="num">${e(money(input.financedCents, input.locale))}</td></tr>
    </tbody>
  </table>

  <h2>${e(t.schedule)}</h2>
  <table>
    <thead>
      <tr><th>${e(t.seq)}</th><th>${e(t.dueDate)}</th><th class="num">${e(t.amount)}</th></tr>
    </thead>
    <tbody>${scheduleRows}</tbody>
  </table>

  <h2>${e(t.terms)}</h2>
  <!-- ⚠ needs accountant/lawyer verification -->
  <div class="box clauses">${clauseLines}</div>

  <div class="sig">
    <div>${e(t.sellerSignature)}</div>
    <div>${e(t.buyerSignature)}</div>
    <div>${e(t.guarantorSignature)}${guarantorNames}</div>
  </div>
</div>
</body>
</html>`;
}
