// Select options for the purchase order form.
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { ok, type Result } from '@/core/result';
import { taxes } from '@/modules/l10n_dz/schema';
import { products } from '@/modules/products/schema';
import { formatDzd } from '@/core/money';

export interface Option { value: string; label: string }

/** Purchase product option: the label shows the cost, and costDzd prefills the line price. */
export interface PurchaseProductOption extends Option {
  name: string;
  costDzd: string;
}

/** Plain DZD decimal text (e.g. "1200.50") from cents. Used as the form's price value, never as money math. */
function centsToDzdText(cents: bigint): string {
  const whole = cents / BigInt(100);
  const frac = cents % BigInt(100);
  return `${whole.toString()}.${frac.toString().padStart(2, '0')}`;
}

/** Active products for the purchase order form. Cost is the default purchase price. */
export async function purchaseProductOptions(ctx: Ctx): Promise<Result<PurchaseProductOption[]>> {
  const perm = requirePerm(ctx, 'purchases.order.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({ id: products.id, name: products.name, costCents: products.costCents })
    .from(products)
    .where(and(eq(products.companyId, ctx.companyId), eq(products.active, true)))
    .orderBy(asc(products.name), asc(products.id))
    .limit(200);
  return ok(
    rows.map((r) => ({
      value: r.id,
      name: r.name,
      costDzd: centsToDzdText(r.costCents),
      label: `${r.name} (${formatDzd(r.costCents, ctx.locale)})`,
    })),
  );
}

/** Active purchase and both-scope taxes for the order form. */
export async function purchaseTaxOptions(ctx: Ctx): Promise<Result<Option[]>> {
  const perm = requirePerm(ctx, 'purchases.order.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({ id: taxes.id, code: taxes.code, name: taxes.name, rate: taxes.rate })
    .from(taxes)
    .where(
      and(
        eq(taxes.companyId, ctx.companyId),
        eq(taxes.active, true),
        inArray(taxes.scope, ['purchase', 'both']),
      ),
    )
    .orderBy(asc(taxes.code));
  return ok(rows.map((r) => ({ value: r.id, label: `${r.name} (${r.rate}%)` })));
}
