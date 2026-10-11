import { asc, desc, eq } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { companies } from '@/core/db/schema';
import { partners } from '@/modules/contacts/schema';
import {
  creditContractLines,
  creditContracts,
  creditGuarantors,
  creditInstallments,
  creditPaymentAllocations,
  creditPayments,
  creditReceipts,
} from '../schema';
import { clauseParagraphs, loadContractSettings, renderClauseTemplate, templateFor } from '../service/clauses';
import { formatDate, labels, money, type CompanyPrint, type PartnerPrint } from './shared';
import type { ReceiptPrintInput } from './receipt-html';
import type { ContractPrintInput } from './contract-html';

// Read-only queries for the receipt and contract print pages. They run inside ctx.tx (RLS applies).

export async function loadCompanyPrint(ctx: Ctx): Promise<CompanyPrint> {
  const [row] = await ctx.tx
    .select({
      legalName: companies.legalName,
      nif: companies.nif,
      rc: companies.rc,
      address: companies.address,
    })
    .from(companies)
    .where(eq(companies.id, ctx.companyId))
    .limit(1);
  return row ?? { legalName: '', nif: null, rc: null, address: null };
}

export interface ReceiptListRow {
  id: string;
  number: string;
  state: string;
  issuedAt: Date;
  totalCents: bigint;
  partnerId: string;
  partnerName: string;
}

export async function listReceiptRows(ctx: Ctx, limit = 200): Promise<ReceiptListRow[]> {
  return ctx.tx
    .select({
      id: creditReceipts.id,
      number: creditReceipts.number,
      state: creditReceipts.state,
      issuedAt: creditReceipts.issuedAt,
      totalCents: creditReceipts.totalCents,
      partnerId: creditReceipts.partnerId,
      partnerName: partners.displayName,
    })
    .from(creditReceipts)
    .leftJoin(partners, eq(partners.id, creditReceipts.partnerId))
    .where(eq(creditReceipts.companyId, ctx.companyId))
    .orderBy(desc(creditReceipts.issuedAt))
    .limit(limit)
    .then((rows) => rows.map((r) => ({ ...r, partnerName: r.partnerName ?? '—' })));
}

/** Returns the printable receipt input, or null when the receipt is not visible in this tenant. */
export async function loadReceiptPrint(
  ctx: Ctx,
  receiptId: string,
): Promise<ReceiptPrintInput | null> {
  const [row] = await ctx.tx
    .select({
      number: creditReceipts.number,
      issuedAt: creditReceipts.issuedAt,
      totalCents: creditReceipts.totalCents,
      voidedAt: creditReceipts.voidedAt,
      method: creditPayments.method,
      reference: creditPayments.reference,
      paymentId: creditPayments.id,
      partnerName: partners.displayName,
      partnerPhone: partners.phone,
    })
    .from(creditReceipts)
    .innerJoin(creditPayments, eq(creditPayments.id, creditReceipts.paymentId))
    .leftJoin(partners, eq(partners.id, creditReceipts.partnerId))
    .where(eq(creditReceipts.id, receiptId))
    .limit(1);
  if (!row) return null;

  const [alloc] = await ctx.tx
    .select({ reference: creditContracts.reference })
    .from(creditPaymentAllocations)
    .innerJoin(creditContracts, eq(creditContracts.id, creditPaymentAllocations.contractId))
    .where(eq(creditPaymentAllocations.paymentId, row.paymentId))
    .limit(1);

  return {
    locale: ctx.locale,
    number: row.number,
    issuedAt: row.issuedAt,
    totalCents: row.totalCents,
    method: row.method,
    reference: row.reference,
    contractReference: alloc?.reference ?? null,
    voided: row.voidedAt !== null,
    company: await loadCompanyPrint(ctx),
    partner: { name: row.partnerName ?? '—', phone: row.partnerPhone ?? null },
  };
}

/** Returns the printable contract input, or null when the contract is not visible in this tenant. */
export async function loadContractPrint(
  ctx: Ctx,
  contractId: string,
): Promise<ContractPrintInput | null> {
  const [c] = await ctx.tx
    .select({
      reference: creditContracts.reference,
      startDate: creditContracts.startDate,
      frequency: creditContracts.frequency,
      installmentsCount: creditContracts.installmentsCount,
      cashPriceCents: creditContracts.cashPriceCents,
      markupCents: creditContracts.markupCents,
      totalCents: creditContracts.totalCents,
      downPaymentCents: creditContracts.downPaymentCents,
      financedCents: creditContracts.financedCents,
      confirmedAt: creditContracts.confirmedAt,
      createdAt: creditContracts.createdAt,
      partnerName: partners.displayName,
      partnerPhone: partners.phone,
      partnerAddress: partners.address,
    })
    .from(creditContracts)
    .leftJoin(partners, eq(partners.id, creditContracts.partnerId))
    .where(eq(creditContracts.id, contractId))
    .limit(1);
  if (!c) return null;

  const lines = await ctx.tx
    .select({
      description: creditContractLines.description,
      quantity: creditContractLines.quantity,
      unitPriceCents: creditContractLines.unitPriceCents,
      lineTotalCents: creditContractLines.lineTotalCents,
    })
    .from(creditContractLines)
    .where(eq(creditContractLines.contractId, contractId))
    .orderBy(asc(creditContractLines.lineNo));

  const schedule = await ctx.tx
    .select({
      seq: creditInstallments.seq,
      dueDate: creditInstallments.dueDate,
      amountCents: creditInstallments.amountCents,
    })
    .from(creditInstallments)
    .where(eq(creditInstallments.contractId, contractId))
    .orderBy(asc(creditInstallments.seq));

  const guarantors = await ctx.tx
    .select({ fullName: creditGuarantors.fullName, phone: creditGuarantors.phone })
    .from(creditGuarantors)
    .where(eq(creditGuarantors.contractId, contractId))
    .orderBy(asc(creditGuarantors.createdAt));

  const settings = await loadContractSettings(ctx);
  const company = await loadCompanyPrint(ctx);
  const frequency = c.frequency === 'weekly' ? 'weekly' : 'monthly';
  const t = labels(ctx.locale);
  const first = schedule[0];
  const contractDate = c.confirmedAt ?? c.createdAt;
  const rendered = renderClauseTemplate(templateFor(ctx.locale, settings), {
    client_nom: c.partnerName,
    // Partners store only a hash of the national ID, so the NIN stays a blank line on the print.
    client_nin: null,
    client_adresse: c.partnerAddress,
    societe_nom: company.legalName,
    societe_nif: company.nif,
    montant_comptant: money(c.cashPriceCents, ctx.locale),
    apport: money(c.downPaymentCents, ctx.locale),
    montant_finance: money(c.financedCents, ctx.locale),
    majoration: money(c.markupCents, ctx.locale),
    nombre_echeances: String(c.installmentsCount),
    montant_echeance: first ? money(first.amountCents, ctx.locale) : null,
    date_premiere_echeance: formatDate(first?.dueDate ?? c.startDate, ctx.locale),
    frequence: frequency === 'weekly' ? t.weekly : t.monthly,
    penalite_retard: settings.latePenaltyRate,
    garant_nom: guarantors.map((g) => g.fullName).join(', ') || null,
    date_contrat: formatDate(contractDate, ctx.locale),
    ville: settings.city,
  });

  return {
    locale: ctx.locale,
    reference: c.reference,
    startDate: c.startDate,
    frequency,
    installmentsCount: c.installmentsCount,
    company,
    partner: { name: c.partnerName ?? '—', phone: c.partnerPhone ?? null } satisfies PartnerPrint,
    lines,
    cashPriceCents: c.cashPriceCents,
    markupCents: c.markupCents,
    totalCents: c.totalCents,
    downPaymentCents: c.downPaymentCents,
    financedCents: c.financedCents,
    schedule: schedule.map((s) => ({ seq: s.seq, dueDate: s.dueDate, amountCents: s.amountCents })),
    clauses: clauseParagraphs(rendered),
    guarantors,
  };
}
