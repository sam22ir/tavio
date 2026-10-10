'use server';

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import { parseDzd } from '@/core/money';
import { err, ok, type Result } from '@/core/result';
import { insertDraft, type NewInvoice } from './service/create';
import { updateDraftInvoice } from './service/update';
import { cancelInvoice, createRefund, PAYMENT_METHODS, postInvoice, registerPayment } from './service/invoices';


const MODULE = 'invoicing';
const WRITE = 'invoicing.invoice.write';
const PAY = 'invoicing.payment.write';
const dayString = z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional());
const idInput = z.object({ id: z.uuid() });

const optionalUuid = z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.uuid().nullable());

const draftLineInput = z.object({
  productId: optionalUuid,
  description: z.string().trim().min(1).max(300),
  quantity: z.string().regex(/^\d+(\.\d{1,3})?$/),
  unitPrice: z.string().min(1),
  discount: z.string().trim().max(10).optional(),
  taxId: optionalUuid,
});

const draftInput = z.object({
  type: z.enum(['out_invoice', 'in_invoice']),
  partnerId: z.uuid(),
  date: dayString,
  dueDate: dayString,
  lines: z.array(draftLineInput).min(1).max(200),
});

const paymentInput = z.object({
  id: z.uuid(),
  amount: z.string().min(1),
  method: z.enum(PAYMENT_METHODS),
  date: dayString,
  reference: z.preprocess((v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined), z.string().max(100).optional()),
});

function failTo(path: string, code: string): never {
  redirect(`${path}?error=${encodeURIComponent(code)}`);
}

/** Converts the validated draft form into service input. Prices are parsed here, never as floats. */
function toNewInvoice(input: z.infer<typeof draftInput>): Result<NewInvoice> {
  const lines: NewInvoice['lines'] = [];
  for (const [i, l] of input.lines.entries()) {
    const price = parseDzd(l.unitPrice);
    if (price === null) return err('VALIDATION', 'invalid amount', { field: `lines.${i}.unitPrice` });
    lines.push({
      productId: l.productId,
      description: l.description,
      quantity: l.quantity,
      unitPriceCents: price,
      discountRate: l.discount ?? '0',
      taxId: l.taxId,
    });
  }
  return ok({ type: input.type, partnerId: input.partnerId, date: input.date, dueDate: input.dueDate, lines });
}

export const createDraftAction = defineAction({ perm: WRITE, schema: draftInput, module: MODULE }, (ctx, input) => {
  const conv = toNewInvoice(input);
  if (!conv.ok) return Promise.resolve(conv);
  return insertDraft(ctx, conv.value);
});

export const updateDraftAction = defineAction(
  { perm: WRITE, schema: draftInput.extend({ id: z.uuid() }), module: MODULE },
  (ctx, { id, ...input }) => {
    const conv = toNewInvoice(input);
    if (!conv.ok) return Promise.resolve(conv);
    return updateDraftInvoice(ctx, id, conv.value);
  },
);

const postAction = defineAction({ perm: WRITE, schema: idInput, module: MODULE }, (ctx, { id }) => postInvoice(ctx, id));
const cancelAction = defineAction({ perm: WRITE, schema: idInput, module: MODULE }, (ctx, { id }) => cancelInvoice(ctx, id));
const refundAction = defineAction({ perm: WRITE, schema: idInput, module: MODULE }, (ctx, { id }) => createRefund(ctx, id));
const payAction = defineAction({ perm: PAY, schema: paymentInput, module: MODULE }, async (ctx, input) => {
  const amount = parseDzd(input.amount);
  if (amount === null) return err('VALIDATION', 'invalid amount', { field: 'amount' }) as Result<never>;
  return registerPayment(ctx, input.id, { amountCents: amount, method: input.method, date: input.date, reference: input.reference ?? null });
});

function detailPath(formData: FormData, locale: string, id: string): string {
  const kind = String(formData.get('kind')) === 'vendors' ? 'vendors' : 'customers';
  return `/${locale}/invoicing/${kind}/${id}`;
}

export async function postInvoiceForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const id = String(formData.get('id'));
  const r = await postAction({ id } as never);
  if (!r.ok) failTo(detailPath(formData, locale, id), r.error.code);
  redirect(detailPath(formData, locale, id));
}

export async function cancelInvoiceForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const id = String(formData.get('id'));
  const r = await cancelAction({ id } as never);
  if (!r.ok) failTo(detailPath(formData, locale, id), r.error.code);
  redirect(detailPath(formData, locale, id));
}

export async function refundInvoiceForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const id = String(formData.get('id'));
  const r = await refundAction({ id } as never);
  if (!r.ok) failTo(detailPath(formData, locale, id), r.error.code);
  redirect(`/${locale}/invoicing/${String(formData.get('kind')) === 'vendors' ? 'vendors' : 'customers'}/${r.value.id}`);
}

export async function registerPaymentForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const id = String(formData.get('id'));
  const r = await payAction(Object.fromEntries(formData) as never);
  if (!r.ok) failTo(detailPath(formData, locale, id), r.error.code);
  redirect(detailPath(formData, locale, id));
}
