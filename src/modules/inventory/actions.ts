'use server';

import { failureQuery } from '@/ui/feedback/failure-query';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { defineAction, toFormAction } from '@/core/actions/define-action';
import type { FormState } from '@/core/entities/types';
import { cancelMove, createMove, validateMove } from './service/moves';
import { createAdjustment } from './service/adjustments';
import { createReorderRule } from './service/stock';
import { createWarehouse } from './service/warehouses';
import {
  attachDeliveryFile,
  cancelDelivery,
  setDeliverySignedBy,
  validateDelivery,
  SIGNED_BY_NAME_MAX,
  SIGNED_BY_REQUIRED,
} from './service/deliveries';
import { MAX_FILE_BYTES } from '@/core/files/service';

const MODULE = 'inventory';

const uuid = z.uuid();
const optional = (s: z.ZodString) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), s.optional());

const warehouseInput = z.object({
  code: z.string().min(1).max(12),
  name: z.string().min(1).max(120),
  wilayaCode: optional(z.string()),
});
const moveInput = z.object({
  productId: uuid,
  quantity: z.string().min(1).max(20),
  fromLocationId: uuid,
  toLocationId: uuid,
  reference: optional(z.string().max(60)),
});
const idInput = z.object({ id: uuid });
const adjustmentInput = z.object({
  productId: uuid,
  locationId: uuid,
  countedQty: z.string().min(1).max(20),
});
const reorderInput = z.object({
  productId: uuid,
  warehouseId: uuid,
  minQty: z.string().min(1).max(20),
  maxQty: optional(z.string().max(20)),
});

const createWarehouseAction = defineAction(
  { perm: 'inventory.warehouse.write', schema: warehouseInput, module: MODULE },
  createWarehouse,
);
const createMoveAction = defineAction(
  { perm: 'inventory.move.write', schema: moveInput, module: MODULE },
  createMove,
);
const validateMoveAction = defineAction(
  { perm: 'inventory.move.post', schema: idInput, module: MODULE },
  (ctx, { id }) => validateMove(ctx, id),
);
const cancelMoveAction = defineAction(
  { perm: 'inventory.move.cancel', schema: idInput, module: MODULE },
  (ctx, { id }) => cancelMove(ctx, id),
);
const adjustmentAction = defineAction(
  { perm: 'inventory.adjustment.write', schema: adjustmentInput, module: MODULE },
  createAdjustment,
);
const deliveryValidateAction = defineAction(
  { perm: 'inventory.delivery.post', schema: idInput, module: MODULE },
  (ctx, { id }) => validateDelivery(ctx, id),
);
const deliverySignedByAction = defineAction(
  {
    perm: 'inventory.delivery.post',
    schema: z.object({ id: uuid, signedByName: z.string().max(SIGNED_BY_NAME_MAX) }),
    module: MODULE,
  },
  (ctx, { id, signedByName }) => setDeliverySignedBy(ctx, { deliveryId: id, signedByName }),
);
const deliveryFileAction = defineAction(
  {
    perm: 'inventory.delivery.post',
    schema: z.object({
      id: uuid,
      kind: z.enum(['signature', 'proof']),
      fileName: z.string().min(1).max(200),
      contentType: z.string().max(100),
      bytes: z.instanceof(Uint8Array).refine((b) => b.byteLength > 0 && b.byteLength <= MAX_FILE_BYTES, 'invalid size'),
    }),
    module: MODULE,
  },
  (ctx, input) =>
    attachDeliveryFile(ctx, {
      deliveryId: input.id,
      kind: input.kind,
      fileName: input.fileName,
      contentType: input.contentType,
      bytes: input.bytes,
    }),
);
const deliveryCancelAction = defineAction(
  { perm: 'inventory.delivery.cancel', schema: idInput, module: MODULE },
  (ctx, { id }) => cancelDelivery(ctx, id),
);
const reorderAction = defineAction(
  { perm: 'inventory.reorder.write', schema: reorderInput, module: MODULE },
  createReorderRule,
);

/** Form action for /inventory/warehouses. */
export async function createWarehouseForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(createWarehouseAction, {
    schema: warehouseInput,
    redirectTo: () => `/${locale}/inventory/warehouses`,
  })(prev, formData);
}

/** Form action for /inventory/moves/new. */
export async function createMoveForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(createMoveAction, {
    schema: moveInput,
    redirectTo: ({ moveId }) => `/${locale}/inventory/moves/${moveId}`,
  })(prev, formData);
}

/** Form action for /inventory/adjustments. */
export async function createAdjustmentForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(adjustmentAction, {
    schema: adjustmentInput,
    redirectTo: () => `/${locale}/inventory`,
  })(prev, formData);
}

/** Form action for /inventory/low-stock. */
export async function createReorderRuleForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(reorderAction, {
    schema: reorderInput,
    redirectTo: () => `/${locale}/inventory/low-stock`,
  })(prev, formData);
}

/** Validate button on the moves list and detail page. */
export async function validateMoveForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const id = String(formData.get('id') ?? '');
  const r = await validateMoveAction({ id });
  redirect(`/${locale}/inventory/moves/${encodeURIComponent(id)}${failureQuery(r)}`);
}

/** Cancel button on a draft move. */
export async function cancelMoveForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const id = String(formData.get('id') ?? '');
  const r = await cancelMoveAction({ id });
  redirect(`/${locale}/inventory/moves/${encodeURIComponent(id)}${failureQuery(r)}`);
}

/** Validate button on the deliveries list. */
export async function validateDeliveryForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const id = String(formData.get('id') ?? '');
  const r = await deliveryValidateAction({ id });
  const reason = !r.ok ? r.error.details?.reason : undefined;
  const query = reason === SIGNED_BY_REQUIRED ? `?error=${SIGNED_BY_REQUIRED}` : failureQuery(r);
  redirect(`/${locale}/inventory/deliveries${query}`);
}

/** Cancel button on the deliveries list. */
export async function cancelDeliveryForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const id = String(formData.get('id') ?? '');
  const r = await deliveryCancelAction({ id });
  redirect(`/${locale}/inventory/deliveries${failureQuery(r)}`);
}

/** Signed-by name form on the delivery detail page. */
export async function saveDeliverySignedByForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const id = String(formData.get('id') ?? '');
  const raw = formData.get('signedByName');
  const r = await deliverySignedByAction({ id, signedByName: typeof raw === 'string' ? raw : '' });
  redirect(`/${locale}/inventory/deliveries/${id}${failureQuery(r)}`);
}

/** Signature or proof upload on the delivery detail page. */
export async function uploadDeliveryFileForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const id = String(formData.get('id') ?? '');
  const kindRaw = formData.get('kind');
  const file = formData.get('file');
  const back = `/${locale}/inventory/deliveries/${id}`;
  if (!(file instanceof File) || (kindRaw !== 'signature' && kindRaw !== 'proof')) {
    redirect(`${back}?error=VALIDATION`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const r = await deliveryFileAction({
    id,
    kind: kindRaw,
    fileName: file.name || 'file',
    contentType: file.type,
    bytes,
  });
  redirect(`${back}${failureQuery(r)}`);
}
