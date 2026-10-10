import { on } from '@/core/events';
import type { Ctx } from '@/core/ctx';
import type {
  CreditContractActivated,
  CreditPaymentRecorded,
  InvoicePaymentRegistered,
  InvoicePosted,
  InventoryMovePosted,
  PosOrderPaid,
} from '@/core/events/catalog';
import { and, eq, sql } from 'drizzle-orm';
import { invoiceLines as invoiceLineRows, invoices } from '@/modules/invoicing/schema';
import { products } from '@/modules/products/schema';
import { creditContracts, creditPayments } from '@/modules/credit_sales/schema';
import { postEntry } from './service/entries';
import { ensureDefaults } from './service/chart';
import { creditContractLines, creditPaymentLines, invoiceLines, paymentLines, posLines, stockMoveLines } from './service/posting';

// Side-effect module: imported from src/modules/accounting/index.ts so the handlers are registered.
// Handlers run in the emitter's transaction. A failed post throws so the emitter's transaction rolls back.
// Every entry is idempotent by (source entity, source id), enforced by postEntry.

function bigOrZero(value: string): bigint {
  return BigInt(value);
}

async function mustPost(ctx: Ctx, input: Parameters<typeof postEntry>[1]): Promise<void> {
  const result = await postEntry(ctx, input);
  if (!result.ok) throw new Error(`accounting: ${result.error.code} ${result.error.message}`);
}

on('invoicing.invoice.posted', async (ctx, event) => {
  const p = event.payload as InvoicePosted;
  const isSale = p.type === 'out_invoice' || p.type === 'out_refund';
  // Vendor bills: the stock-tracked goods part goes to 380 so it nets against the receipt (perpetual inventory).
  let stockedUntaxedCents = 0n;
  if (!isSale) {
    const [row] = await ctx.tx
      .select({ total: sql<string>`coalesce(sum(${invoiceLineRows.subtotalCents}), 0)` })
      .from(invoiceLineRows)
      .innerJoin(products, eq(products.id, invoiceLineRows.productId))
      .where(
        and(
          eq(invoiceLineRows.invoiceId, p.invoiceId),
          eq(invoiceLineRows.companyId, ctx.companyId),
          eq(products.kind, 'goods'),
          eq(products.trackStock, true),
        ),
      );
    stockedUntaxedCents = BigInt(row?.total ?? '0');
  }
  await mustPost(ctx, {
    journalCode: isSale ? 'VT' : 'AC',
    date: p.date,
    ref: p.number,
    sourceEntity: 'invoicing.invoice',
    sourceId: p.invoiceId,
    lines: invoiceLines({
      type: p.type,
      partnerId: p.partnerId,
      number: p.number,
      untaxedCents: bigOrZero(p.untaxedCents),
      taxCents: bigOrZero(p.taxCents),
      stampCents: bigOrZero(p.stampCents),
      totalCents: bigOrZero(p.totalCents),
      stockedUntaxedCents,
    }),
  });
});

on('invoicing.payment.registered', async (ctx, event) => {
  const p = event.payload as InvoicePaymentRegistered;
  const [invoice] = await ctx.tx
    .select({ number: invoices.number })
    .from(invoices)
    .where(and(eq(invoices.id, p.invoiceId), eq(invoices.companyId, ctx.companyId)))
    .limit(1);
  const invoiceNumber = invoice?.number ?? p.invoiceId;
  await mustPost(ctx, {
    journalCode: p.method === 'cash' ? 'CA' : 'BQ',
    date: p.date,
    ref: invoiceNumber,
    sourceEntity: 'invoicing.payment',
    sourceId: p.paymentId,
    lines: paymentLines({
      type: p.type,
      partnerId: p.partnerId,
      amountCents: bigOrZero(p.amountCents),
      method: p.method,
      reference: invoiceNumber,
      stampCents: bigOrZero(p.stampCents ?? '0'),
    }),
  });
});

on('pos.order.paid', async (ctx, event) => {
  const p = event.payload as PosOrderPaid;
  await mustPost(ctx, {
    journalCode: p.method === 'cash' ? 'CA' : 'BQ',
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(new Date()),
    ref: p.number,
    sourceEntity: 'pos.order',
    sourceId: p.orderId,
    lines: posLines({
      orderId: p.orderId,
      number: p.number,
      method: p.method,
      totalCents: bigOrZero(p.totalCents),
      untaxedCents: bigOrZero(p.untaxedCents),
      taxCents: bigOrZero(p.taxCents),
    }),
  });
});

const ALGIERS_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' });

on('credit_sales.contract.activated', async (ctx, event) => {
  const p = event.payload as CreditContractActivated;
  await mustPost(ctx, {
    journalCode: 'VT',
    date: ALGIERS_DAY.format(new Date()),
    ref: p.number,
    sourceEntity: 'credit_sales.contract',
    sourceId: p.contractId,
    lines: creditContractLines({
      partnerId: p.partnerId,
      number: p.number,
      financedCents: bigOrZero(p.financedCents),
      downPaymentCents: bigOrZero(p.downPaymentCents),
      cashPriceCents: bigOrZero(p.cashPriceCents),
      markupCents: bigOrZero(p.markupCents),
    }),
  });
});

// Perpetual inventory: every valued move is booked at its CMUP value in the OD journal (no stock journal exists).
on('inventory.move.posted', async (ctx, event) => {
  const p = event.payload as InventoryMovePosted;
  const lines = stockMoveLines({ kind: p.kind, valueCents: bigOrZero(p.valueCents), reference: p.reference });
  if (lines.length === 0) return;
  await ensureDefaults(ctx);
  await mustPost(ctx, {
    journalCode: 'OD',
    date: p.date,
    ref: p.reference,
    sourceEntity: 'inventory.move',
    sourceId: p.moveId,
    lines,
  });
});

on('credit_sales.payment.recorded', async (ctx, event) => {
  const p = event.payload as CreditPaymentRecorded;
  const [payment] = await ctx.tx
    .select({ method: creditPayments.method, receivedAt: creditPayments.receivedAt })
    .from(creditPayments)
    .where(and(eq(creditPayments.id, p.paymentId), eq(creditPayments.companyId, ctx.companyId)))
    .limit(1);
  if (!payment) throw new Error(`accounting: credit payment ${p.paymentId} not found`);
  const [contract] = await ctx.tx
    .select({ reference: creditContracts.reference })
    .from(creditContracts)
    .where(and(eq(creditContracts.id, p.contractId), eq(creditContracts.companyId, ctx.companyId)))
    .limit(1);
  const reference = contract?.reference ?? p.contractId;
  await mustPost(ctx, {
    journalCode: payment.method === 'cash' ? 'CA' : 'BQ',
    date: ALGIERS_DAY.format(payment.receivedAt),
    ref: reference,
    sourceEntity: 'credit_sales.payment',
    sourceId: p.paymentId,
    lines: creditPaymentLines({
      partnerId: p.partnerId,
      amountCents: bigOrZero(p.amountCents),
      method: payment.method,
      reference,
    }),
  });
});
