// Smart buttons. Side-effect file: imported by modules/relation-handlers.
import { and, count, eq } from 'drizzle-orm';
import { relations } from '@/core/relations';
import { stockMoves } from '@/modules/inventory/schema';

relations.register({
  id: 'purchases.order->inventory.move',
  source: 'purchases.order',
  labelKey: 'relations.purchase.receipts',
  icon: 'Package',
  perm: 'inventory.move.read',
  count: async (ctx, id) => {
    const [row] = await ctx.tx
      .select({ value: count() })
      .from(stockMoves)
      .where(and(eq(stockMoves.companyId, ctx.companyId), eq(stockMoves.sourceId, id)));
    return row?.value ?? 0;
  },
  href: (locale, id) => `/${locale}/inventory/moves?f_sourceId=${id}`,
});
