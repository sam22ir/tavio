'use server';

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { defineAction, toFormAction } from '@/core/actions/define-action';
import type { FormState } from '@/core/entities/types';
import { cancelMove, createMove, validateMove } from './service/moves';
import { createAdjustment } from './service/adjustments';
import { createReorderRule } from './service/stock';
import { createWarehouse } from './service/warehouses';

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
  await validateMoveAction({ id });
  redirect(`/${locale}/inventory/moves/${encodeURIComponent(id)}`);
}

/** Cancel button on a draft move. */
export async function cancelMoveForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const id = String(formData.get('id') ?? '');
  await cancelMoveAction({ id });
  redirect(`/${locale}/inventory/moves/${encodeURIComponent(id)}`);
}
