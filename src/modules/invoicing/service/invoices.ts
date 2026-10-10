import { and, asc, eq, sql } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { emit } from '@/core/events';
import type { InvoicePosted, InvoicePaymentRegistered } from '@/core/events/catalog';
import { nextNumber } from '@/core/sequences';
import { err, ok, type Result } from '@/core/result';
import { invoiceLines, invoicePayments, invoices, type Invoice, type InvoiceLine } from '../schema';
import { insertDraft, today, type NewInvoice } from './create';
import { paymentStateFor, stampDutyCents } from './math';

export const PAYMENT_METHODS = ['cash', 'ccp', 'transfer', 'cib', 'edahabia', 'cheque'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// Number prefixes per type (DATA_MODEL.md, W5-B spec). {YYYY} is expanded by nextNumber.
const NUMBERING: Record<string, { code: string; prefix: string }> = {
  out_invoice: { code: 'invoicing.out_invoice', prefix: 'FAC-{YYYY}-' },
  out_refund: { code: 'invoicing.out_refund', prefix: 'AV-{YYYY}-' },
  in_invoice: { code: 'invoicing.in_invoice', prefix: 'FF-{YYYY}-' },
  in_refund: { code: 'invoicing.in_refund', prefix: 'AVF-{YYYY}-' },
};

export async function loadInvoice(ctx: Ctx, id: string): Promise<Result<{ invoice: Invoice; lines: InvoiceLine[] }>> {
  const [invoice] = await ctx.tx
    .select()
    .from(invoices)
    .where(and(eq(invoices.companyId, ctx.companyId), eq(invoices.id, id)));
  if (!invoice) return err('NOT_FOUND', 'invoice not found');
  const lines = await ctx.tx
    .select()
    .from(invoiceLines)
    .where(and(eq(invoiceLines.companyId, ctx.companyId), eq(invoiceLines.invoiceId, id)))
    .orderBy(asc(invoiceLines.sequence));
  return ok({ invoice, lines });
}

/** Post a draft: assigns the gap-free number, locks the document, emits invoicing.invoice.posted. */
export async function postInvoice(ctx: Ctx, id: string): Promise<Result<{ number: string }>> {
  const loaded = await loadInvoice(ctx, id);
  if (!loaded.ok) return loaded;
  const { invoice, lines } = loaded.value;
  if (invoice.state === 'posted') return err('POSTED_IMMUTABLE', 'invoice is already posted');
  if (invoice.state !== 'draft') return err('STATE', 'only drafts can be posted');
  if (lines.length === 0) return err('VALIDATION', 'invoice has no lines');

  const numbering = NUMBERING[invoice.type]!;
  const number = await nextNumber(ctx, numbering.code, { prefix: numbering.prefix, padding: 5 });
  await ctx.tx
    .update(invoices)
    .set({ state: 'posted', number, updatedAt: new Date() })
    .where(and(eq(invoices.companyId, ctx.companyId), eq(invoices.id, id), eq(invoices.state, 'draft')));
  await audit(ctx, { entity: 'invoicing.invoice', recordId: id, action: 'post', before: { state: 'draft' }, after: { state: 'posted', number } });

  const groups = new Map<string, { taxId: string | null; ratePercent: string; baseCents: bigint; taxCents: bigint }>();
  for (const l of lines) {
    const rate = String(l.taxRate);
    const key = `${l.taxId ?? ''}|${rate}`;
    const g = groups.get(key) ?? { taxId: l.taxId, ratePercent: rate, baseCents: BigInt(0), taxCents: BigInt(0) };
    g.baseCents += l.subtotalCents;
    g.taxCents += l.taxCents;
    groups.set(key, g);
  }
  const payload: InvoicePosted = {
    invoiceId: id,
    type: invoice.type as InvoicePosted['type'],
    partnerId: invoice.partnerId,
    number,
    date: invoice.date,
    untaxedCents: invoice.untaxedCents.toString(),
    taxCents: invoice.taxCents.toString(),
    stampCents: invoice.stampCents.toString(),
    totalCents: invoice.totalCents.toString(),
    taxLines: [...groups.values()].map((g) => ({
      taxId: g.taxId,
      ratePercent: g.ratePercent,
      baseCents: g.baseCents.toString(),
      taxCents: g.taxCents.toString(),
    })),
  };
  await emit(ctx, { name: 'invoicing.invoice.posted', payload });
  return ok({ number });
}

/** Cancels drafts only. Posted documents are corrected with a refund, never cancelled. */
export async function cancelInvoice(ctx: Ctx, id: string): Promise<Result<{ id: string }>> {
  const loaded = await loadInvoice(ctx, id);
  if (!loaded.ok) return loaded;
  const { invoice } = loaded.value;
  if (invoice.state === 'posted') return err('POSTED_IMMUTABLE', 'posted invoices cannot be cancelled; create a refund');
  if (invoice.state !== 'draft') return err('STATE', 'only drafts can be cancelled');
  await ctx.tx
    .update(invoices)
    .set({ state: 'cancelled', updatedAt: new Date() })
    .where(and(eq(invoices.companyId, ctx.companyId), eq(invoices.id, id)));
  await audit(ctx, { entity: 'invoicing.invoice', recordId: id, action: 'cancel', before: { state: 'draft' }, after: { state: 'cancelled' } });
  return ok({ id });
}

/** Edits are only allowed on drafts. Posted documents return POSTED_IMMUTABLE. */
export async function assertDraft(ctx: Ctx, id: string): Promise<Result<Invoice>> {
  const loaded = await loadInvoice(ctx, id);
  if (!loaded.ok) return loaded;
  if (loaded.value.invoice.state !== 'draft') return err('POSTED_IMMUTABLE', 'only drafts can be edited');
  return ok(loaded.value.invoice);
}

/** Creates a draft credit note (refund) mirroring a posted invoice. Post it to get the AV-/AVF- number. */
export async function createRefund(ctx: Ctx, invoiceId: string): Promise<Result<{ id: string }>> {
  const loaded = await loadInvoice(ctx, invoiceId);
  if (!loaded.ok) return loaded;
  const { invoice, lines } = loaded.value;
  if (invoice.state !== 'posted') return err('STATE', 'only posted invoices can be refunded');
  if (invoice.type !== 'out_invoice' && invoice.type !== 'in_invoice') {
    return err('VALIDATION', 'only invoices can be refunded');
  }
  const input: NewInvoice = {
    type: invoice.type === 'out_invoice' ? 'out_refund' : 'in_refund',
    partnerId: invoice.partnerId,
    origin: invoice.number ?? undefined,
    sourceEntity: 'invoicing.invoice',
    sourceId: invoice.id,
    lines: lines.map((l) => ({
      productId: l.productId,
      description: l.description,
      quantity: String(l.quantity),
      unitPriceCents: l.unitPriceCents,
      discountRate: l.discountRate,
      taxId: l.taxId,
    })),
  };
  return insertDraft(ctx, input, { refundOfId: invoice.id });
}

export interface PaymentInput { amountCents: bigint; method: PaymentMethod; date?: string; reference?: string | null }

/**
 * Registers a payment against a posted invoice (≤ residual). A cash payment on an out_invoice
 * adds the timbre fiscal once, computed from that payment amount. ⚠ needs accountant verification
 */
export async function registerPayment(ctx: Ctx, invoiceId: string, input: PaymentInput): Promise<Result<{ paymentId: string }>> {
  const loaded = await loadInvoice(ctx, invoiceId);
  if (!loaded.ok) return loaded;
  const { invoice } = loaded.value;
  if (invoice.state !== 'posted') return err('STATE', 'payments need a posted invoice');
  if (input.amountCents <= BigInt(0)) return err('VALIDATION', 'amount must be positive', { field: 'amountCents' });
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.method)) return err('VALIDATION', 'invalid method', { field: 'method' });
  const date = input.date ?? today();

  let stamp = invoice.stampCents;
  let total = invoice.totalCents;
  const applyStamp = invoice.type === 'out_invoice' && input.method === 'cash' && stamp === BigInt(0);
  if (applyStamp) {
    stamp = stampDutyCents(input.amountCents);
    total += stamp;
  }
  const residual = total - invoice.paidCents;
  if (input.amountCents > residual) {
    return err('VALIDATION', 'amount exceeds residual', { field: 'amountCents', residual: residual.toString() });
  }

  const paid = invoice.paidCents + input.amountCents;
  const state = paymentStateFor(paid, total);
  const [pay] = await ctx.tx
    .insert(invoicePayments)
    .values({
      companyId: ctx.companyId,
      invoiceId,
      amountCents: input.amountCents,
      method: input.method,
      date,
      reference: input.reference ?? null,
      createdBy: ctx.userId,
    })
    .returning({ id: invoicePayments.id });
  if (!pay) return err('INTERNAL', 'insert failed');

  await ctx.tx
    .update(invoices)
    .set({ paidCents: paid, paymentState: state, stampCents: stamp, totalCents: total, updatedAt: sql`now()` })
    .where(and(eq(invoices.companyId, ctx.companyId), eq(invoices.id, invoiceId)));
  await audit(ctx, {
    entity: 'invoicing.invoice',
    recordId: invoiceId,
    action: 'register_payment',
    after: { paymentId: pay.id, amountCents: input.amountCents.toString(), method: input.method, stampCents: stamp.toString() },
  });

  const payload: InvoicePaymentRegistered = {
    paymentId: pay.id,
    invoiceId,
    type: invoice.type as InvoicePaymentRegistered['type'],
    partnerId: invoice.partnerId,
    amountCents: input.amountCents.toString(),
    method: input.method,
    date,
    ...(applyStamp ? { stampCents: stamp.toString() } : {}),
  };
  await emit(ctx, { name: 'invoicing.payment.registered', payload });
  return ok({ paymentId: pay.id });
}
