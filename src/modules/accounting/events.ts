import { on } from '@/core/events';
import type { Ctx } from '@/core/ctx';
import type { InvoicePaymentRegistered, InvoicePosted, PosOrderPaid } from '@/core/events/catalog';
import { and, eq } from 'drizzle-orm';
import { invoices } from '@/modules/invoicing/schema';
import { postEntry } from './service/entries';
import { invoiceLines, paymentLines, posLines } from './service/posting';

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
