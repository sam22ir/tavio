// Smart buttons. Side-effect file: imported by modules/relation-handlers.
import { and, count, eq } from 'drizzle-orm';
import { relations } from '@/core/relations';
import { journalEntries } from '@/modules/accounting/schema';
import { deliveries, stockMoves } from '@/modules/inventory/schema';

relations.register({
  id: 'credit_sales.contract->inventory.delivery',
  source: 'credit_sales.contract',
  labelKey: 'relations.credit.deliveries',
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

relations.register({
  id: 'credit_sales.contract->inventory.move',
  source: 'credit_sales.contract',
  labelKey: 'relations.credit.moves',
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

relations.register({
  id: 'credit_sales.contract->accounting.entry',
  source: 'credit_sales.contract',
  labelKey: 'relations.credit.entries',
  icon: 'BookOpen',
  perm: 'accounting.entry.read',
  count: async (ctx, id) => {
    const [row] = await ctx.tx
      .select({ value: count() })
      .from(journalEntries)
      .where(and(eq(journalEntries.companyId, ctx.companyId), eq(journalEntries.sourceId, id)));
    return row?.value ?? 0;
  },
  href: (locale, id) => `/${locale}/accounting/entries?f_sourceId=${id}`,
});
