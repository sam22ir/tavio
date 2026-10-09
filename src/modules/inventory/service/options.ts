import { and, asc, eq } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { ok, type Result } from '@/core/result';
import { products } from '@/modules/products/schema';

export interface SelectOption { value: string; label: string }

/** Active goods, for product selects on inventory forms. */
export async function goodsOptions(ctx: Ctx): Promise<Result<SelectOption[]>> {
  const perm = requirePerm(ctx, 'inventory.move.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({ id: products.id, name: products.name, sku: products.sku })
    .from(products)
    .where(and(eq(products.companyId, ctx.companyId), eq(products.kind, 'goods')))
    .orderBy(asc(products.name));
  return ok(rows.map((r) => ({ value: r.id, label: r.sku ? `${r.name} (${r.sku})` : r.name })));
}
