// Select options for the purchase order form.
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { ok, type Result } from '@/core/result';
import { taxes } from '@/modules/l10n_dz/schema';

export interface Option { value: string; label: string }

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
