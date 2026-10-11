import { sql, and, eq } from 'drizzle-orm';
import { on } from '@/core/events';
import type { InventoryDeliveryValidated } from '@/core/events/catalog';
import type { Ctx } from '@/core/ctx';
import { saleOrderLines } from './schema';
import { syncOrderProgress } from './service/orders';

// Side-effect module: imported from src/modules/sales/index.ts so the handlers are registered.

// A validated delivery of a sale order adds what it handed over and dropped to the order lines, then the
// order's delivery and invoice progress is recomputed (the order is done once everything is delivered and billed).
on('inventory.delivery.validated', async (ctx: Ctx, event) => {
  const p = event.payload as InventoryDeliveryValidated;
  if (p.sourceEntity !== 'sales.order' || !p.sourceId) return;
  for (const line of p.lines) {
    await ctx.tx
      .update(saleOrderLines)
      .set({
        deliveredQty: sql`${saleOrderLines.deliveredQty} + ${line.deliveredQty}::numeric`,
        cancelledQty: sql`${saleOrderLines.cancelledQty} + ${line.cancelledQty}::numeric`,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(saleOrderLines.id, line.saleOrderLineId),
          eq(saleOrderLines.orderId, p.sourceId),
          eq(saleOrderLines.companyId, ctx.companyId),
        ),
      );
  }
  const synced = await syncOrderProgress(ctx, p.sourceId);
  if (!synced.ok) throw new Error(synced.error.message);
});
