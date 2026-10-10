// Smart buttons. Side-effect file: imported by modules/relation-handlers.
import { and, count, eq } from 'drizzle-orm';
import { relations } from '@/core/relations';
import { deliveries } from '@/modules/inventory/schema';

relations.register({
  id: 'sales.order->inventory.delivery',
  source: 'sales.order',
  labelKey: 'relations.order.deliveries',
  icon: 'Truck',
  perm: 'inventory.delivery.read',
  count: async (ctx, id) => {
    const [row] = await ctx.tx
      .select({ value: count() })
      .from(deliveries)
      .where(and(eq(deliveries.companyId, ctx.companyId), eq(deliveries.sourceId, id)));
    return row?.value ?? 0;
  },
  href: (locale, id) => `/${locale}/inventory/deliveries?f_sourceId=${id}`,
});
