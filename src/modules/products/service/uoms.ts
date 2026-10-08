import { asc } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { ok, type Result } from '@/core/result';
import { uoms } from '../schema';

// Global units of measure (no company_id). Label follows the request locale, falling back to French.
export async function uomOptions(ctx: Ctx): Promise<Result<{ value: string; label: string }[]>> {
  const perm = requirePerm(ctx, 'products.product.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({ id: uoms.id, nameFr: uoms.nameFr, nameAr: uoms.nameAr, nameEn: uoms.nameEn, code: uoms.code })
    .from(uoms)
    .orderBy(asc(uoms.category), asc(uoms.code));
  return ok(
    rows.map((r) => {
      const localized = ctx.locale === 'ar' ? r.nameAr : ctx.locale === 'en' ? r.nameEn : null;
      return { value: r.id, label: localized ?? r.nameFr };
    }),
  );
}
