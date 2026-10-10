// Idempotent repair for demo companies whose seeded documents were never posted to accounting.
// Each entry is built from the stored row with the same builders the live event handlers use
// (src/modules/accounting/events.ts), then posted with postEntry. postEntry returns the existing entry
// for a (source entity, source id) pair, so a second run posts nothing.
// Entry dates are the original document dates, not today.
import { and, asc, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import type { Db } from '@/core/db/types';
import { companies } from '@/core/db/schema/tenancy';
import { invoiceLines as invoiceLineRows, invoicePayments, invoices } from '@/modules/invoicing/schema';
import { products } from '@/modules/products/schema';
import {
  creditContracts,
  creditInstallments,
  creditPaymentAllocations,
  creditPayments,
} from '@/modules/credit_sales/schema';
import { posOrders } from '@/modules/pos/schema';
import { getL10nSettings } from '@/modules/l10n_dz/service/settings';
import { postEntry } from '@/modules/accounting/service/entries';
import {
  creditContractLines,
  creditPaymentLines,
  invoiceLines,
  paymentLines,
  posLines,
} from '@/modules/accounting/service/posting';

export interface AccountingRepairCounts {
  posted: number;
  existing: number;
  skipped: number;
}

export interface AccountingRepairReport {
  invoices: AccountingRepairCounts;
  invoicePayments: AccountingRepairCounts;
  creditContracts: AccountingRepairCounts;
  creditPayments: AccountingRepairCounts;
  posOrders: AccountingRepairCounts;
  skippedReasons: string[];
}

const ALGIERS_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' });

function emptyCounts(): AccountingRepairCounts {
  return { posted: 0, existing: 0, skipped: 0 };
}

type Bucket = keyof Omit<AccountingRepairReport, 'skippedReasons'>;

function record(report: AccountingRepairReport, bucket: Bucket, result: { ok: true; value: { existing: boolean } } | { ok: false; error: { code: string; message: string } }, label: string): void {
  if (!result.ok) {
    report[bucket].skipped += 1;
    report.skippedReasons.push(`${label}: ${result.error.code} ${result.error.message}`);
    return;
  }
  if (result.value.existing) report[bucket].existing += 1;
  else report[bucket].posted += 1;
}

async function repairInTx(ctx: Ctx): Promise<AccountingRepairReport> {
  const report: AccountingRepairReport = {
    invoices: emptyCounts(),
    invoicePayments: emptyCounts(),
    creditContracts: emptyCounts(),
    creditPayments: emptyCounts(),
    posOrders: emptyCounts(),
    skippedReasons: [],
  };
  const settings = await getL10nSettings(ctx);

  // 1. Posted customer invoices and vendor bills (mirrors the invoicing.invoice.posted handler).
  const posted = await ctx.tx
    .select()
    .from(invoices)
    .where(and(eq(invoices.companyId, ctx.companyId), ne(invoices.state, 'draft'), isNotNull(invoices.number)))
    .orderBy(asc(invoices.date), asc(invoices.createdAt));
  for (const inv of posted) {
    const isSale = inv.type === 'out_invoice' || inv.type === 'out_refund';
    let stockedUntaxedCents = 0n;
    if (!isSale) {
      const [row] = await ctx.tx
        .select({ total: sql<string>`coalesce(sum(${invoiceLineRows.subtotalCents}), 0)` })
        .from(invoiceLineRows)
        .innerJoin(products, eq(products.id, invoiceLineRows.productId))
        .where(
          and(
            eq(invoiceLineRows.invoiceId, inv.id),
            eq(invoiceLineRows.companyId, ctx.companyId),
            eq(products.kind, 'goods'),
            eq(products.trackStock, true),
          ),
        );
      stockedUntaxedCents = BigInt(row?.total ?? '0');
    }
    const result = await postEntry(ctx, {
      journalCode: isSale ? 'VT' : 'AC',
      date: inv.date,
      ref: inv.number ?? '',
      sourceEntity: 'invoicing.invoice',
      sourceId: inv.id,
      lines: invoiceLines({
        type: inv.type as 'out_invoice' | 'out_refund' | 'in_invoice' | 'in_refund',
        partnerId: inv.partnerId,
        number: inv.number ?? '',
        untaxedCents: inv.untaxedCents,
        taxCents: inv.taxCents,
        stampCents: inv.stampCents,
        totalCents: inv.totalCents,
        stockedUntaxedCents,
      }),
    });
    record(report, 'invoices', result, `invoice ${inv.number}`);
  }

  // 2. Invoice payments (mirrors invoicing.payment.registered). The stamp sits on the first payment whose method
  // carries stamp duty, as the live flow applies it once per invoice.
  const payments = await ctx.tx
    .select({
      payment: invoicePayments,
      type: invoices.type,
      partnerId: invoices.partnerId,
      number: invoices.number,
      invoiceStamp: invoices.stampCents,
    })
    .from(invoicePayments)
    .innerJoin(invoices, eq(invoices.id, invoicePayments.invoiceId))
    .where(and(eq(invoicePayments.companyId, ctx.companyId), ne(invoices.state, 'draft')))
    .orderBy(asc(invoicePayments.date), asc(invoicePayments.createdAt));
  const stampPaymentByInvoice = new Map<string, string>();
  for (const row of payments) {
    const invoiceId = row.payment.invoiceId;
    if (stampPaymentByInvoice.has(invoiceId)) continue;
    if (row.type === 'out_invoice' && row.invoiceStamp > 0n && settings.stampMethods.includes(row.payment.method)) {
      stampPaymentByInvoice.set(invoiceId, row.payment.id);
    }
  }
  for (const row of payments) {
    const p = row.payment;
    const stamp = stampPaymentByInvoice.get(p.invoiceId) === p.id ? row.invoiceStamp : 0n;
    const result = await postEntry(ctx, {
      journalCode: p.method === 'cash' ? 'CA' : 'BQ',
      date: p.date,
      ref: row.number ?? p.invoiceId,
      sourceEntity: 'invoicing.payment',
      sourceId: p.id,
      lines: paymentLines({
        type: row.type as 'out_invoice' | 'out_refund' | 'in_invoice' | 'in_refund',
        partnerId: row.partnerId,
        amountCents: p.amountCents,
        method: p.method,
        reference: row.number ?? p.invoiceId,
        stampCents: stamp,
      }),
    });
    record(report, 'invoicePayments', result, `payment ${p.id}`);
  }

  // 3. Activated credit contracts (mirrors credit_sales.contract.activated). Dated by the activation day.
  const contracts = await ctx.tx
    .select()
    .from(creditContracts)
    .where(and(eq(creditContracts.companyId, ctx.companyId), isNotNull(creditContracts.confirmedAt)))
    .orderBy(asc(creditContracts.confirmedAt));
  for (const c of contracts) {
    const result = await postEntry(ctx, {
      journalCode: 'VT',
      date: ALGIERS_DAY.format(c.confirmedAt ?? new Date(c.startDate)),
      ref: c.reference,
      sourceEntity: 'credit_sales.contract',
      sourceId: c.id,
      lines: creditContractLines({
        partnerId: c.partnerId,
        number: c.reference,
        financedCents: c.financedCents,
        downPaymentCents: c.downPaymentCents,
        cashPriceCents: c.cashPriceCents,
        markupCents: c.markupCents,
      }),
    });
    record(report, 'creditContracts', result, `contract ${c.reference}`);
  }

  // 4. Instalment payments (mirrors credit_sales.payment.recorded). Reversal rows were never posted live.
  const creditRows = await ctx.tx
    .select({ payment: creditPayments })
    .from(creditPayments)
    .where(and(eq(creditPayments.companyId, ctx.companyId), isNull(creditPayments.reversalOfId)))
    .orderBy(asc(creditPayments.receivedAt));
  for (const row of creditRows) {
    const p = row.payment;
    // The contract is the one the payment was allocated to, directly or through an instalment.
    const [link] = await ctx.tx
      .select({ contractId: sql<string | null>`coalesce(${creditPaymentAllocations.contractId}, ${creditInstallments.contractId})` })
      .from(creditPaymentAllocations)
      .leftJoin(creditInstallments, eq(creditInstallments.id, creditPaymentAllocations.installmentId))
      .where(eq(creditPaymentAllocations.paymentId, p.id))
      .limit(1);
    const [contract] = link?.contractId
      ? await ctx.tx.select({ reference: creditContracts.reference }).from(creditContracts).where(eq(creditContracts.id, link.contractId)).limit(1)
      : [];
    const reference = contract?.reference ?? p.id;
    const result = await postEntry(ctx, {
      journalCode: p.method === 'cash' ? 'CA' : 'BQ',
      date: ALGIERS_DAY.format(p.receivedAt),
      ref: reference,
      sourceEntity: 'credit_sales.payment',
      sourceId: p.id,
      lines: creditPaymentLines({
        partnerId: p.partnerId,
        amountCents: p.amountCents,
        method: p.method,
        reference,
      }),
    });
    record(report, 'creditPayments', result, `credit payment ${p.id}`);
  }

  // 5. POS orders (mirrors pos.order.paid). Dated by the sale day.
  const pos = await ctx.tx
    .select()
    .from(posOrders)
    .where(eq(posOrders.companyId, ctx.companyId))
    .orderBy(asc(posOrders.paidAt));
  for (const o of pos) {
    const result = await postEntry(ctx, {
      journalCode: o.method === 'cash' ? 'CA' : 'BQ',
      date: ALGIERS_DAY.format(o.paidAt),
      ref: o.number,
      sourceEntity: 'pos.order',
      sourceId: o.id,
      lines: posLines({
        orderId: o.id,
        number: o.number,
        method: o.method,
        totalCents: o.totalCents,
        untaxedCents: o.untaxedCents,
        taxCents: o.taxCents,
      }),
    });
    record(report, 'posOrders', result, `pos order ${o.number}`);
  }

  return report;
}

/** Posts the missing accounting entries of one company. Safe to run again: a second run posts nothing new. */
export async function repairDemoAccounting(tenant: TenantArgs, db: Db): Promise<AccountingRepairReport> {
  const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, tenant.companyId));
  if (!company) throw new Error('company not found');
  return withTenant(tenant, (ctx) => repairInTx(ctx), db);
}
