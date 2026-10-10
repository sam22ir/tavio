// Smart buttons on a product detail page. Side-effect file: imported by modules/relation-handlers.
import { and, count, countDistinct, eq } from 'drizzle-orm';
import { relations } from '@/core/relations';
import { stockMoves } from '@/modules/inventory/schema';
import { purchaseOrderLines } from '@/modules/purchases/schema';
import { saleOrderLines } from '@/modules/sales/schema';

relations.register({
  id: 'products.product->sales.order',
  source: 'products.product',
  labelKey: 'relations.product.orders',
  icon: 'ShoppingCart',
  perm: 'sales.order.read',
  count: async (ctx, id) => {
    const [row] = await ctx.tx
      .select({ value: countDistinct(saleOrderLines.orderId) })
      .from(saleOrderLines)
      .where(and(eq(saleOrderLines.companyId, ctx.companyId), eq(saleOrderLines.productId, id)));
    return row?.value ?? 0;
  },
  href: (locale, id) => `/${locale}/sales?f_productId=${id}`,
});

relations.register({
  id: 'products.product->purchases.order',
  source: 'products.product',
  labelKey: 'relations.product.purchase_orders',
  icon: 'Briefcase',
  perm: 'purchases.order.read',
  count: async (ctx, id) => {
    const [row] = await ctx.tx
      .select({ value: countDistinct(purchaseOrderLines.orderId) })
      .from(purchaseOrderLines)
      .where(and(eq(purchaseOrderLines.companyId, ctx.companyId), eq(purchaseOrderLines.productId, id)));
    return row?.value ?? 0;
  },
  href: (locale, id) => `/${locale}/purchases?f_productId=${id}`,
});


relations.register({
  id: 'products.product->inventory.move',
  source: 'products.product',
  labelKey: 'relations.product.moves',
  icon: 'Package',
  perm: 'inventory.move.read',
  count: async (ctx, id) => {
    const [row] = await ctx.tx
      .select({ value: count() })
      .from(stockMoves)
      .where(and(eq(stockMoves.companyId, ctx.companyId), eq(stockMoves.productId, id)));
    return row?.value ?? 0;
  },
  href: (locale, id) => `/${locale}/inventory/moves?f_productId=${id}`,
});
