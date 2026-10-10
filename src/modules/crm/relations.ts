// Smart buttons on a lead detail page. Side-effect file: imported by modules/relation-handlers.
import { and, count, eq } from 'drizzle-orm';
import { relations } from '@/core/relations';
import { saleOrders } from '@/modules/sales/schema';

relations.register({
  id: 'crm.lead->sales.order',
  source: 'crm.lead',
  labelKey: 'relations.lead.orders',
  icon: 'ShoppingCart',
  perm: 'sales.order.read',
  count: async (ctx, id) => {
    const [row] = await ctx.tx
      .select({ value: count() })
      .from(saleOrders)
      .where(and(eq(saleOrders.companyId, ctx.companyId), eq(saleOrders.leadId, id)));
    return row?.value ?? 0;
  },
  href: (locale, id) => `/${locale}/sales?f_leadId=${id}`,
});
