import { on } from '@/core/events';
import type { PosOrderPaid, PurchaseOrderReceived, SalesOrderConfirmed } from '@/core/events/catalog';
import type { Ctx } from '@/core/ctx';
import { ensureDefaultWarehouse } from './service/warehouses';
import { moveLines } from './service/moves';

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
