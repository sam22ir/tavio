import { eq } from 'drizzle-orm';
import { on } from '@/core/events';
import type { SalesOrderConfirmed } from '@/core/events/catalog';
import type { Ctx } from '@/core/ctx';
import { saleOrders } from '@/modules/sales/schema';
import { markLeadWonFromQuote } from './service/leads';

// Side-effect module: imported from src/modules/event-handlers.ts so the handler is registered.
// A quotation linked to a lead that gets confirmed wins the lead. Other sales orders are ignored.
on('sales.order.confirmed', async (ctx: Ctx, event) => {
  const p = event.payload as SalesOrderConfirmed;
  const [order] = await ctx.tx
    .select({ leadId: saleOrders.leadId })
    .from(saleOrders)
    .where(eq(saleOrders.id, p.orderId));
  if (!order?.leadId) return;
  await markLeadWonFromQuote(ctx, order.leadId, p.number);
});
