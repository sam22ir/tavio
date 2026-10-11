import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { partners } from '@/modules/contacts/schema';
import { creditContracts, creditInstallments, creditPaymentAllocations, creditReceipts } from '@/modules/credit_sales/schema';
import { invoices } from '@/modules/invoicing/schema';
import type { PortalScope } from './context';

// Read-only portal queries. Each one filters by the session's partner id (scope.partnerId).

export interface PortalHomeSummary {
  partnerName: string;
  invoicesDueCount: number;
  invoicesDueCents: bigint;
  installmentsDueCount: number;
  installmentsDueCents: bigint;
  installmentsOverdueCount: number;
  installmentsOverdueCents: bigint;
}

function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function portalPartnerName(scope: PortalScope): Promise<string> {
  const [p] = await scope.ctx.tx
    .select({ name: partners.displayName })
    .from(partners)
    .where(and(eq(partners.companyId, scope.companyId), eq(partners.id, scope.partnerId)));
  return p?.name ?? '';
}

export async function portalHomeSummary(scope: PortalScope, now: Date = new Date()): Promise<PortalHomeSummary> {
  const { ctx } = scope;
  const partnerName = await portalPartnerName(scope);
  const dueInvoices = await ctx.tx
    .select({ total: invoices.totalCents, paid: invoices.paidCents })
    .from(invoices)
    .where(and(
      eq(invoices.companyId, scope.companyId),
      eq(invoices.partnerId, scope.partnerId),
      eq(invoices.type, 'out_invoice'),
      eq(invoices.state, 'posted'),
      ne(invoices.paymentState, 'paid'),
    ))
    .limit(500);
  const open = await ctx.tx
    .select({
      dueDate: creditInstallments.dueDate,
      amount: creditInstallments.amountCents,
      paid: creditInstallments.paidCents,
    })
    .from(creditInstallments)
    .innerJoin(creditContracts, eq(creditContracts.id, creditInstallments.contractId))
    .where(and(
      eq(creditInstallments.companyId, scope.companyId),
      eq(creditContracts.partnerId, scope.partnerId),
      eq(creditContracts.state, 'active'),
      sql`${creditInstallments.paidCents} < ${creditInstallments.amountCents}`,
    ))
    .limit(500);

  const today = todayIso(now);
  const summary: PortalHomeSummary = {
    partnerName,
    invoicesDueCount: dueInvoices.length,
    invoicesDueCents: dueInvoices.reduce((s, r) => s + (r.total - r.paid), BigInt(0)),
    installmentsDueCount: 0,
    installmentsDueCents: BigInt(0),
    installmentsOverdueCount: 0,
    installmentsOverdueCents: BigInt(0),
  };
  for (const row of open) {
    const remaining = row.amount - row.paid;
    if (row.dueDate < today) {
      summary.installmentsOverdueCount += 1;
      summary.installmentsOverdueCents += remaining;
    } else {
      summary.installmentsDueCount += 1;
      summary.installmentsDueCents += remaining;
    }
  }
  return summary;
}

export interface PortalInvoiceRow {
  id: string;
  number: string | null;
  type: string;
  date: string;
  dueDate: string | null;
  totalCents: bigint;
  paidCents: bigint;
  paymentState: string;
}

export async function listPortalInvoices(scope: PortalScope): Promise<PortalInvoiceRow[]> {
  const rows = await scope.ctx.tx
    .select({
      id: invoices.id,
      number: invoices.number,
      type: invoices.type,
      date: invoices.date,
      dueDate: invoices.dueDate,
      totalCents: invoices.totalCents,
      paidCents: invoices.paidCents,
      paymentState: invoices.paymentState,
    })
    .from(invoices)
    .where(and(
      eq(invoices.companyId, scope.companyId),
      eq(invoices.partnerId, scope.partnerId),
      inArray(invoices.type, ['out_invoice', 'out_refund']),
      eq(invoices.state, 'posted'),
    ))
    .orderBy(desc(invoices.date), desc(invoices.createdAt))
    .limit(200);
  return rows.map((r) => ({ ...r, date: String(r.date), dueDate: r.dueDate ? String(r.dueDate) : null }));
}

/** True when the invoice is a posted sale invoice or refund of this partner. Drafts are never shown. */
export async function partnerOwnsPostedInvoice(scope: PortalScope, invoiceId: string): Promise<boolean> {
  const rows = await scope.ctx.tx
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(
      eq(invoices.companyId, scope.companyId),
      eq(invoices.id, invoiceId),
      eq(invoices.partnerId, scope.partnerId),
      inArray(invoices.type, ['out_invoice', 'out_refund']),
      eq(invoices.state, 'posted'),
    ));
  return rows.length > 0;
}

export interface PortalContractRow {
  id: string;
  reference: string;
  state: string;
  startDate: string;
  totalCents: bigint;
  financedCents: bigint;
  installmentsCount: number;
}

export async function listPortalContracts(scope: PortalScope): Promise<PortalContractRow[]> {
  const rows = await scope.ctx.tx
    .select({
      id: creditContracts.id,
      reference: creditContracts.reference,
      state: creditContracts.state,
      startDate: creditContracts.startDate,
      totalCents: creditContracts.totalCents,
      financedCents: creditContracts.financedCents,
      installmentsCount: creditContracts.installmentsCount,
    })
    .from(creditContracts)
    .where(and(
      eq(creditContracts.companyId, scope.companyId),
      eq(creditContracts.partnerId, scope.partnerId),
      ne(creditContracts.state, 'draft'),
    ))
    .orderBy(desc(creditContracts.startDate))
    .limit(200);
  return rows.map((r) => ({ ...r, startDate: String(r.startDate) }));
}

/** True when the contract belongs to this partner and is past draft. */
export async function partnerOwnsContract(scope: PortalScope, contractId: string): Promise<boolean> {
  const rows = await scope.ctx.tx
    .select({ id: creditContracts.id })
    .from(creditContracts)
    .where(and(
      eq(creditContracts.companyId, scope.companyId),
      eq(creditContracts.id, contractId),
      eq(creditContracts.partnerId, scope.partnerId),
      ne(creditContracts.state, 'draft'),
    ));
  return rows.length > 0;
}

export interface PortalReceiptRow {
  id: string;
  number: string;
  issuedAt: Date;
  totalCents: bigint;
  voided: boolean;
}

export async function listPortalReceipts(scope: PortalScope): Promise<PortalReceiptRow[]> {
  const rows = await scope.ctx.tx
    .select({
      id: creditReceipts.id,
      number: creditReceipts.number,
      issuedAt: creditReceipts.issuedAt,
      totalCents: creditReceipts.totalCents,
      voidedAt: creditReceipts.voidedAt,
    })
    .from(creditReceipts)
    .where(and(
      eq(creditReceipts.companyId, scope.companyId),
      eq(creditReceipts.partnerId, scope.partnerId),
    ))
    .orderBy(desc(creditReceipts.issuedAt))
    .limit(200);
  return rows.map((r) => ({ id: r.id, number: r.number, issuedAt: r.issuedAt, totalCents: r.totalCents, voided: r.voidedAt !== null }));
}

/** True when the receipt belongs to this partner. */
export async function partnerOwnsReceipt(scope: PortalScope, receiptId: string): Promise<boolean> {
  const rows = await scope.ctx.tx
    .select({ id: creditReceipts.id })
    .from(creditReceipts)
    .where(and(
      eq(creditReceipts.companyId, scope.companyId),
      eq(creditReceipts.id, receiptId),
      eq(creditReceipts.partnerId, scope.partnerId),
    ));
  return rows.length > 0;
}


/** True when the receipt's payment was allocated to this contract. Used for contract-scoped sessions. */
export async function receiptBelongsToContract(scope: PortalScope, receiptId: string, contractId: string): Promise<boolean> {
  const [receipt] = await scope.ctx.tx
    .select({ paymentId: creditReceipts.paymentId })
    .from(creditReceipts)
    .where(and(
      eq(creditReceipts.companyId, scope.companyId),
      eq(creditReceipts.id, receiptId),
      eq(creditReceipts.partnerId, scope.partnerId),
    ));
  if (!receipt) return false;
  const rows = await scope.ctx.tx
    .select({ id: creditPaymentAllocations.id })
    .from(creditPaymentAllocations)
    .where(and(
      eq(creditPaymentAllocations.companyId, scope.companyId),
      eq(creditPaymentAllocations.paymentId, receipt.paymentId),
      eq(creditPaymentAllocations.contractId, contractId),
    ))
    .limit(1);
  return rows.length > 0;
}
