import { and, eq } from 'drizzle-orm';
import { on } from '@/core/events';
import type {
  CreditContractStateChanged,
  PosOrderPaid,
  PurchaseOrderReceived,
  SalesOrderConfirmed,
} from '@/core/events/catalog';
import type { Ctx } from '@/core/ctx';
import { creditContractLines } from '@/modules/credit_sales/schema';
import { ensureDefaultWarehouse } from './service/warehouses';
import { moveLines } from './service/moves';
import { closeReservations, releasesContractReservations, reserveLines } from './service/reservations';
import { cancelOpenDeliveriesForSource, createDraftDelivery } from './service/deliveries';

const CONTRACT_ENTITY = 'credit_sales.contract';

// Side-effect module: imported from src/modules/inventory/index.ts so the handlers are registered.
// Handlers check by source id and product before creating anything, so redelivery is safe.

// Sales confirmation: delivery moves stay draft until someone validates them.
on('sales.order.confirmed', async (ctx: Ctx, event) => {
  const p = event.payload as SalesOrderConfirmed;
  const wh = await ensureDefaultWarehouse(ctx);
  await moveLines(ctx, {
    lines: p.lines,
    sourceEntity: 'sales.order',
    sourceId: p.orderId,
    reference: p.number,
    fromLocationId: wh.internalLocationId,
    toLocationId: wh.customerLocationId,
    post: false,
  });
});

// Purchase receipt: goods are in stock as soon as the order is received.
on('purchases.order.received', async (ctx: Ctx, event) => {
  const p = event.payload as PurchaseOrderReceived;
  const wh = await ensureDefaultWarehouse(ctx);
  await moveLines(ctx, {
    lines: p.lines,
    sourceEntity: 'purchases.order',
    sourceId: p.orderId,
    reference: p.number,
    fromLocationId: wh.supplierLocationId,
    toLocationId: wh.internalLocationId,
    post: true,
  });
});

// POS sale: goods leave stock when the order is paid.
on('pos.order.paid', async (ctx: Ctx, event) => {
  const p = event.payload as PosOrderPaid;
  const wh = await ensureDefaultWarehouse(ctx);
  await moveLines(ctx, {
    lines: p.lines,
    sourceEntity: 'pos.order',
    sourceId: p.orderId,
    reference: p.number,
    fromLocationId: wh.internalLocationId,
    toLocationId: wh.customerLocationId,
    post: true,
  });
});

// Credit contract workflow. Approved reserves the contract lines, active creates a draft delivery,
// refused or cancelled releases the reservations, cancelled also cancels the open deliveries.
// Each step is idempotent: the services check by source before writing.
on('credit_sales.contract.state_changed', async (ctx: Ctx, event) => {
  const p = event.payload as CreditContractStateChanged;
  if (releasesContractReservations(p.toState)) {
    const released = await closeReservations(ctx, { sourceEntity: CONTRACT_ENTITY, sourceId: p.contractId, state: 'released' });
    if (!released.ok) throw new Error(released.error.message);
  }
  if (p.toState === 'cancelled') {
    const cancelled = await cancelOpenDeliveriesForSource(ctx, { sourceEntity: CONTRACT_ENTITY, sourceId: p.contractId });
    if (!cancelled.ok) throw new Error(cancelled.error.message);
    return;
  }
  if (p.toState === 'refused') return;
  if (p.toState !== 'approved' && p.toState !== 'active') return;

  const lines = await ctx.tx
    .select({ productId: creditContractLines.productId, quantity: creditContractLines.quantity })
    .from(creditContractLines)
    .where(and(eq(creditContractLines.companyId, ctx.companyId), eq(creditContractLines.contractId, p.contractId)));

  if (p.toState === 'approved') {
    const wh = await ensureDefaultWarehouse(ctx);
    const reserved = await reserveLines(ctx, {
      lines,
      locationId: wh.internalLocationId,
      sourceEntity: CONTRACT_ENTITY,
      sourceId: p.contractId,
    });
    if (!reserved.ok) throw new Error(reserved.error.message);
    return;
  }

  const delivery = await createDraftDelivery(ctx, {
    partnerId: p.partnerId,
    sourceEntity: CONTRACT_ENTITY,
    sourceId: p.contractId,
    lines,
  });
  if (!delivery.ok) throw new Error(delivery.error.message);
});
