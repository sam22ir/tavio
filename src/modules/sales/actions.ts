'use server';

import { z } from 'zod';
import { defineAction } from '@/core/actions/define-action';
import {
  cancelOrder,
  confirmOrder,
  createInvoiceFromOrder,
  createSaleOrder,
  markOrderSent,
  saleLookups,
  saleOrderInput,
  updateSaleOrder,
} from './service/orders';

const MODULE = 'sales';
const idInput = z.object({ id: z.uuid() });
const updateInput = saleOrderInput.extend({ id: z.uuid() });

export const createSaleOrderAction = defineAction(
  { perm: 'sales.order.write', schema: saleOrderInput, module: MODULE },
  (ctx, input) => createSaleOrder(ctx, input),
);

export const updateSaleOrderAction = defineAction(
  { perm: 'sales.order.write', schema: updateInput, module: MODULE },
  (ctx, { id, ...input }) => updateSaleOrder(ctx, id, input),
);

export const markOrderSentAction = defineAction(
  { perm: 'sales.order.write', schema: idInput, module: MODULE },
  (ctx, { id }) => markOrderSent(ctx, id),
);

export const confirmOrderAction = defineAction(
  { perm: 'sales.order.post', schema: idInput, module: MODULE },
  (ctx, { id }) => confirmOrder(ctx, id),
);

export const cancelOrderAction = defineAction(
  { perm: 'sales.order.cancel', schema: idInput, module: MODULE },
  (ctx, { id }) => cancelOrder(ctx, id),
);

export const createInvoiceFromOrderAction = defineAction(
  { perm: 'sales.order.write', schema: idInput, module: MODULE },
  (ctx, { id }) => createInvoiceFromOrder(ctx, id),
);

export const saleLookupsAction = defineAction(
  { perm: 'sales.order.read', schema: z.object({}), module: MODULE },
  (ctx) => saleLookups(ctx),
);
