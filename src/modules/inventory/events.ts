import { and, eq } from 'drizzle-orm';
import { on } from '@/core/events';
import type {
  CreditContractStateChanged,
  PosOrderPaid,
  PurchaseOrderReceived,
  SalesOrderCancelled,
  SalesOrderConfirmed,
} from '@/core/events/catalog';
import type { Ctx } from '@/core/ctx';
import { creditContractLines } from '@/modules/credit_sales/schema';
import { ensureDefaultWarehouse } from './service/warehouses';
import { moveLines, stockTrackedLines } from './service/moves';
import { closeReservations, releasesContractReservations, reserveLines } from './service/reservations';
import {
  cancelOpenDeliveriesForSource,
  createDraftDelivery,
  createOrderDelivery,
  returnDoneDeliveriesForSource,
  SALE_ORDER_SOURCE_ENTITY as SALE_ORDER_ENTITY,
} from './service/deliveries';

const CONTRACT_ENTITY = 'credit_sales.contract';

// Side-effect module: imported from src/modules/inventory/index.ts so the handlers are registered.
// Handlers check by source id and product before creating anything, so redelivery is safe.

// Sales confirmation: one draft delivery for the stock-tracked goods lines. Validating it posts the moves
// for what is actually handed over (partial deliveries and backorders are handled by the delivery service).
on('sales.order.confirmed', async (ctx: Ctx, event) => {
  const p = event.payload as SalesOrderConfirmed;
  const tracked = await stockTrackedLines(ctx, p.lines);
  if (tracked.length === 0) return;
  const created = await createOrderDelivery(ctx, {
    partnerId: p.partnerId,
    sourceEntity: SALE_ORDER_ENTITY,
    sourceId: p.orderId,
    lines: tracked.map((l) => ({ productId: l.productId ?? '', quantity: l.quantity, saleOrderLineId: l.saleOrderLineId })),
  });
  if (!created.ok) throw new Error(created.error.message);
});

// Sales cancellation: open deliveries are cancelled and their reservations released. The sales service
// refuses the cancel once anything was delivered, so no done delivery is touched here.
on('sales.order.cancelled', async (ctx: Ctx, event) => {
  const p = event.payload as SalesOrderCancelled;
  const cancelled = await cancelOpenDeliveriesForSource(ctx, { sourceEntity: SALE_ORDER_ENTITY, sourceId: p.orderId });
  if (!cancelled.ok) throw new Error(cancelled.error.message);
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
    // Goods already validated go back into stock (customer to internal); open deliveries are cancelled.
    const returned = await returnDoneDeliveriesForSource(ctx, { sourceEntity: CONTRACT_ENTITY, sourceId: p.contractId });
    if (!returned.ok) throw new Error(returned.error.message);
    const cancelled = await cancelOpenDeliveriesForSource(ctx, { sourceEntity: CONTRACT_ENTITY, sourceId: p.contractId });
    if (!cancelled.ok) throw new Error(cancelled.error.message);
    return;
  }
  if (p.toState === 'refused') return;
  if (p.toState !== 'approved' && p.toState !== 'active') return;

  const lines = await stockTrackedLines(
    ctx,
    await ctx.tx
      .select({ productId: creditContractLines.productId, quantity: creditContractLines.quantity })
      .from(creditContractLines)
      .where(and(eq(creditContractLines.companyId, ctx.companyId), eq(creditContractLines.contractId, p.contractId))),
  );

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
