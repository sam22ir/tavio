'use server';

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import type { FormState } from '@/core/entities/types';
import { parseDzd } from '@/core/money';
import { err, type AppError, type Result } from '@/core/result';
import { messageKeyFor } from './ui/errors';
import {
  cancelOrder,
  confirmOrder,
  createBillFromOrder,
  createOrder,
  receiveOrder,
  type OrderInput,
  type OrderLineInput,
  type ReceiveLineInput,
} from './service/orders';
import { QTY_RE, parseQty } from './service/math';

const MODULE = 'purchases';
const WRITE = 'purchases.order.write';
const POST = 'purchases.order.post';
const CANCEL = 'purchases.order.cancel';

// Raw form shape. unitPrice is DZD text, converted with parseDzd inside the action.
const rawLine = z.object({
  productId: z.uuid().nullable(),
  description: z.string().trim().min(1).max(200),
  quantity: z.string().regex(QTY_RE),
  unitPrice: z.string().trim().min(1).max(30),
  taxId: z.uuid().nullable(),
});
const rawOrder = z.object({
  partnerId: z.uuid(),
  expectedDate: z.iso.date().nullable(),
  note: z.string().trim().max(1000).nullable(),
  lines: z.array(rawLine).min(1).max(100),
});
const idInput = z.object({ id: z.uuid() });
const receiveInput = z.object({
  id: z.uuid(),
  lines: z.array(z.object({ lineId: z.uuid(), quantity: z.string().regex(QTY_RE) })).nullable(),
});

function toOrderInput(raw: z.infer<typeof rawOrder>): Result<OrderInput> {
  const lines: OrderLineInput[] = [];
  for (const line of raw.lines) {
    const unitPriceCents = parseDzd(line.unitPrice);
    if (unitPriceCents === null) return err('VALIDATION', 'invalid unit price');
    lines.push({
      productId: line.productId,
      description: line.description,
      quantity: line.quantity,
      unitPriceCents,
      taxId: line.taxId,
    });
  }
  return { ok: true, value: { partnerId: raw.partnerId, expectedDate: raw.expectedDate, note: raw.note, lines } };
}

const createOrderAction = defineAction({ perm: WRITE, schema: rawOrder, module: MODULE }, async (ctx, raw) => {
  const input = toOrderInput(raw);
  if (!input.ok) return { ok: false, error: input.error };
  return createOrder(ctx, input.value);
});

const confirmAction = defineAction({ perm: POST, schema: idInput, module: MODULE }, (ctx, { id }) =>
  confirmOrder(ctx, id),
);
const receiveAction = defineAction({ perm: POST, schema: receiveInput, module: MODULE }, (ctx, { id, lines }) =>
  receiveOrder(ctx, id, lines ?? undefined),
);
const billAction = defineAction({ perm: POST, schema: idInput, module: MODULE }, (ctx, { id }) =>
  createBillFromOrder(ctx, id),
);
const cancelAction = defineAction({ perm: CANCEL, schema: idInput, module: MODULE }, (ctx, { id }) =>
  cancelOrder(ctx, id),
);

const emptyToNull = (v: FormDataEntryValue | null): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '' ? null : s;
};

/** Reads the order form: header fields plus line-0..line-N rows (empty rows are skipped). */
function readOrderForm(formData: FormData): unknown {
  const lines: unknown[] = [];
  for (let i = 0; i < 100; i += 1) {
    const description = emptyToNull(formData.get(`line-${i}-description`));
    const productId = emptyToNull(formData.get(`line-${i}-productId`));
    if (description === null && productId === null) continue;
    lines.push({
      productId,
      description,
      quantity: emptyToNull(formData.get(`line-${i}-quantity`)) ?? '',
      unitPrice: emptyToNull(formData.get(`line-${i}-unitPrice`)) ?? '',
      taxId: emptyToNull(formData.get(`line-${i}-taxId`)),
    });
  }
  return {
    partnerId: emptyToNull(formData.get('partnerId')) ?? '',
    expectedDate: emptyToNull(formData.get('expectedDate')),
    note: emptyToNull(formData.get('note')),
    lines,
  };
}

/** Form action for /purchases/new. */
export async function createOrderForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const result = await createOrderAction(readOrderForm(formData) as z.input<typeof rawOrder>);
  if (!result.ok) return { ok: false, message: messageKeyFor(result.error) };
  redirect(`/${await getLocale()}/purchases/${result.value.id}`);
}

async function backToOrder(id: string, error?: AppError): Promise<never> {
  const locale = await getLocale();
  const suffix = error ? `?error=${encodeURIComponent(error.code)}` : '';
  redirect(`/${locale}/purchases/${encodeURIComponent(id)}${suffix}`);
}

/** Form action: confirm a draft. */
export async function confirmOrderForm(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const result = await confirmAction({ id });
  return backToOrder(id, result.ok ? undefined : result.error);
}

/** Form action: receive. mode=all receives every remaining quantity; otherwise the qty-<lineId> fields. */
export async function receiveOrderForm(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  let input: z.input<typeof receiveInput> = { id, lines: null };
  if (formData.get('mode') !== 'all') {
    const lines: ReceiveLineInput[] = [];
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith('qty-') || typeof value !== 'string' || value.trim() === '') continue;
      const quantity = value.trim();
      if (parseQty(quantity) === null) {
        return backToOrder(id, { code: 'VALIDATION', message: 'invalid quantity' });
      }
      lines.push({ lineId: key.slice(4), quantity });
    }
    input = { id, lines };
  }
  const result = await receiveAction(input);
  return backToOrder(id, result.ok ? undefined : result.error);
}

/** Form action: create the vendor bill for what was received. */
export async function createBillForm(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const result = await billAction({ id });
  return backToOrder(id, result.ok ? undefined : result.error);
}

/** Form action: cancel a draft or confirmed order with nothing received. */
export async function cancelOrderForm(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const result = await cancelAction({ id });
  return backToOrder(id, result.ok ? undefined : result.error);
}
