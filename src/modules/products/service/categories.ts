import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Ctx } from '@/core/ctx';
import { audit } from '@/core/audit';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { productCategories } from '../schema';

export const categoryInput = z.object({
  name: z.string().trim().min(1).max(120),
  code: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((v) => (v ? v : null)),
  parentId: z
    .string()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.uuid().nullable()),
});
export type CategoryInput = z.infer<typeof categoryInput>;

export interface CategoryRow {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
}

export async function listCategories(ctx: Ctx): Promise<Result<CategoryRow[]>> {
  const perm = requirePerm(ctx, 'products.category.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({
      id: productCategories.id,
      name: productCategories.name,
      code: productCategories.code,
      parentId: productCategories.parentId,
    })
    .from(productCategories)
    .where(eq(productCategories.companyId, ctx.companyId))
    .orderBy(asc(productCategories.name), asc(productCategories.id));
  return ok(rows);
}

export async function createCategory(ctx: Ctx, input: CategoryInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'products.category.write');
  if (!perm.ok) return perm;

  const [dup] = await ctx.tx
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(and(eq(productCategories.companyId, ctx.companyId), sql`lower(${productCategories.name}) = lower(${input.name})`))
    .limit(1);
  if (dup) return err('CONFLICT', 'category name already exists', { field: 'name' });

  if (input.parentId) {
    const [parent] = await ctx.tx
      .select({ id: productCategories.id })
      .from(productCategories)
      .where(and(eq(productCategories.id, input.parentId), eq(productCategories.companyId, ctx.companyId)))
      .limit(1);
    if (!parent) return err('VALIDATION', 'unknown parent category', { issues: [{ path: ['parentId'], message: 'unknown' }] });
  }

  const [row] = await ctx.tx
    .insert(productCategories)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      name: input.name,
      code: input.code,
      parentId: input.parentId,
    })
    .returning({ id: productCategories.id });
  if (!row) return err('INTERNAL', 'insert failed');

  await audit(ctx, { entity: 'products.category', recordId: row.id, action: 'create', after: input });
  return ok({ id: row.id });
}
