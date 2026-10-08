import { and, asc, desc, eq, ilike, ne, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { Ctx } from '@/core/ctx';
import { audit } from '@/core/audit';
import { parseDzd, formatDzd, type Cents } from '@/core/money';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import type { ListQuery, ListResult, Row } from '@/core/entities/types';
import { productCategories, products, uoms } from '../schema';

const ALLOWED_SORT: Record<string, SQL> = {
  name: sql`${products.name}`,
  sku: sql`${products.sku}`,
  kind: sql`${products.kind}`,
  salePriceCents: sql`${products.salePriceCents}`,
  active: sql`${products.active}`,
};

const checkbox = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));
const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.uuid().nullable());
const dzdAmount = z.string().trim().refine((s) => parseDzd(s) !== null, { message: 'invalid amount' });

// Form and action input. Money arrives as DZD text ("1500.50") and is parsed in the service.
export const productInput = z.object({
  name: z.string().trim().min(1).max(200),
  nameAr: optionalText(200),
  sku: optionalText(64),
  barcode: optionalText(64),
  categoryId: optionalUuid,
  kind: z.enum(['goods', 'service']),
  uomId: z.uuid(),
  salePriceCents: dzdAmount,
  costCents: dzdAmount,
  trackStock: checkbox,
  active: checkbox,
  description: optionalText(2000),
});
export type ProductInput = z.infer<typeof productInput>;

export const productUpdateInput = productInput.extend({ id: z.uuid() });
export type ProductUpdateInput = z.infer<typeof productUpdateInput>;

export interface ProductSummary {
  id: string;
  name: string;
  sku: string | null;
  kind: string;
  salePriceCents: Cents;
  active: boolean;
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function parseCentsOrError(raw: string): Result<Cents> {
  const cents = parseDzd(raw);
  if (cents === null) {
    return err('VALIDATION', 'invalid amount', { issues: [{ path: ['salePriceCents'], message: 'invalid amount' }] });
  }
  return ok(cents);
}

async function assertRefs(
  ctx: Ctx,
  input: { categoryId: string | null; uomId: string },
): Promise<Result<void>> {
  const [uom] = await ctx.tx.select({ id: uoms.id }).from(uoms).where(eq(uoms.id, input.uomId)).limit(1);
  if (!uom) return err('VALIDATION', 'unknown unit of measure', { issues: [{ path: ['uomId'], message: 'unknown' }] });
  if (input.categoryId) {
    const [cat] = await ctx.tx
      .select({ id: productCategories.id })
      .from(productCategories)
      .where(and(eq(productCategories.id, input.categoryId), eq(productCategories.companyId, ctx.companyId)))
      .limit(1);
    if (!cat) {
      return err('VALIDATION', 'unknown category', { issues: [{ path: ['categoryId'], message: 'unknown' }] });
    }
  }
  return ok(undefined);
}

async function assertUniqueKeys(
  ctx: Ctx,
  input: { sku: string | null; barcode: string | null },
  exceptId?: string,
): Promise<Result<void>> {
  const clauses: SQL[] = [];
  if (input.sku) clauses.push(eq(products.sku, input.sku));
  if (input.barcode) clauses.push(eq(products.barcode, input.barcode));
  if (clauses.length === 0) return ok(undefined);
  const conds: SQL[] = [eq(products.companyId, ctx.companyId)];
  const match = or(...clauses);
  if (match) conds.push(match);
  if (exceptId) conds.push(ne(products.id, exceptId));
  const where = and(...conds);
  const [dup] = await ctx.tx.select({ id: products.id }).from(products).where(where).limit(1);
  if (dup) return err('CONFLICT', 'sku or barcode already used', { field: 'sku' });
  return ok(undefined);
}

export async function listProducts(ctx: Ctx, q: ListQuery): Promise<Result<ListResult>> {
  const perm = requirePerm(ctx, 'products.product.read');
  if (!perm.ok) return perm;

  const conds: SQL[] = [eq(products.companyId, ctx.companyId)];
  if (q.q) {
    const pattern = `%${escapeLike(q.q)}%`;
    const search = or(
      ilike(products.name, pattern),
      ilike(products.nameAr, pattern),
      ilike(products.sku, pattern),
      ilike(products.barcode, pattern),
    );
    if (search) conds.push(search);
  }
  if (q.filters.categoryId) conds.push(eq(products.categoryId, q.filters.categoryId));
  if (q.filters.kind === 'goods' || q.filters.kind === 'service') conds.push(eq(products.kind, q.filters.kind));
  if (q.filters.active === 'true') conds.push(eq(products.active, true));
  if (q.filters.active === 'false') conds.push(eq(products.active, false));
  const where = and(...conds);

  const sortCol: SQL = (q.sort && ALLOWED_SORT[q.sort]) || sql`${products.name}`;
  const order = q.dir === 'desc' ? desc(sortCol) : asc(sortCol);

  const [countRow] = await ctx.tx.select({ n: sql<number>`count(*)::int` }).from(products).where(where);
  const rows = await ctx.tx
    .select({
      id: products.id,
      name: products.name,
      nameAr: products.nameAr,
      sku: products.sku,
      barcode: products.barcode,
      categoryId: products.categoryId,
      categoryIdLabel: productCategories.name,
      kind: products.kind,
      uomId: products.uomId,
      uomIdLabel: uoms.nameFr,
      salePriceCents: products.salePriceCents,
      costCents: products.costCents,
      trackStock: products.trackStock,
      active: products.active,
      description: products.description,
    })
    .from(products)
    .leftJoin(productCategories, eq(productCategories.id, products.categoryId))
    .innerJoin(uoms, eq(uoms.id, products.uomId))
    .where(where)
    .orderBy(order, asc(products.id))
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);

  return ok({ rows: rows as Row[], total: countRow?.n ?? 0, page: q.page, pageSize: q.pageSize });
}

export async function getProduct(ctx: Ctx, id: string): Promise<Result<Row>> {
  const perm = requirePerm(ctx, 'products.product.read');
  if (!perm.ok) return perm;
  const [row] = await ctx.tx
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.companyId, ctx.companyId)))
    .limit(1);
  if (!row) return err('NOT_FOUND', 'product not found');
  return ok(row as Row);
}

export async function createProduct(ctx: Ctx, input: ProductInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'products.product.write');
  if (!perm.ok) return perm;

  const sale = parseCentsOrError(input.salePriceCents);
  if (!sale.ok) return sale;
  const cost = parseCentsOrError(input.costCents);
  if (!cost.ok) return cost;

  const refs = await assertRefs(ctx, input);
  if (!refs.ok) return refs;
  const unique = await assertUniqueKeys(ctx, input);
  if (!unique.ok) return unique;

  const [row] = await ctx.tx
    .insert(products)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      name: input.name,
      nameAr: input.nameAr,
      sku: input.sku,
      barcode: input.barcode,
      categoryId: input.categoryId,
      kind: input.kind,
      uomId: input.uomId,
      salePriceCents: sale.value,
      costCents: cost.value,
      trackStock: input.trackStock,
      active: input.active,
      description: input.description,
    })
    .returning({ id: products.id });
  if (!row) return err('INTERNAL', 'insert failed');

  await audit(ctx, { entity: 'products.product', recordId: row.id, action: 'create', after: input });
  return ok({ id: row.id });
}

export async function updateProduct(ctx: Ctx, input: ProductUpdateInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'products.product.write');
  if (!perm.ok) return perm;

  const sale = parseCentsOrError(input.salePriceCents);
  if (!sale.ok) return sale;
  const cost = parseCentsOrError(input.costCents);
  if (!cost.ok) return cost;

  const [before] = await ctx.tx
    .select()
    .from(products)
    .where(and(eq(products.id, input.id), eq(products.companyId, ctx.companyId)))
    .for('update');
  if (!before) return err('NOT_FOUND', 'product not found');

  const refs = await assertRefs(ctx, input);
  if (!refs.ok) return refs;
  const unique = await assertUniqueKeys(ctx, input, input.id);
  if (!unique.ok) return unique;

  await ctx.tx
    .update(products)
    .set({
      name: input.name,
      nameAr: input.nameAr,
      sku: input.sku,
      barcode: input.barcode,
      categoryId: input.categoryId,
      kind: input.kind,
      uomId: input.uomId,
      salePriceCents: sale.value,
      costCents: cost.value,
      trackStock: input.trackStock,
      active: input.active,
      description: input.description,
      updatedAt: new Date(),
    })
    .where(eq(products.id, input.id));

  await audit(ctx, { entity: 'products.product', recordId: input.id, action: 'update', before, after: input });
  return ok({ id: input.id });
}

export async function archiveProduct(ctx: Ctx, id: string): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'products.product.write');
  if (!perm.ok) return perm;

  const [before] = await ctx.tx
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.companyId, ctx.companyId)))
    .for('update');
  if (!before) return err('NOT_FOUND', 'product not found');
  if (!before.active) return ok({ id });

  await ctx.tx
    .update(products)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(products.id, id));
  await audit(ctx, {
    entity: 'products.product',
    recordId: id,
    action: 'archive',
    before: { active: true },
    after: { active: false },
  });
  return ok({ id });
}

export async function productOptions(
  ctx: Ctx,
  search?: string,
): Promise<Result<{ value: string; label: string }[]>> {
  const perm = requirePerm(ctx, 'products.product.read');
  if (!perm.ok) return perm;

  const conds: SQL[] = [eq(products.companyId, ctx.companyId), eq(products.active, true)];
  const term = search?.trim();
  if (term) {
    const pattern = `%${escapeLike(term)}%`;
    const match = or(ilike(products.name, pattern), ilike(products.sku, pattern));
    if (match) conds.push(match);
  }
  const rows = await ctx.tx
    .select({ id: products.id, name: products.name, salePriceCents: products.salePriceCents })
    .from(products)
    .where(and(...conds))
    .orderBy(asc(products.name), asc(products.id))
    .limit(50);

  return ok(
    rows.map((r) => ({
      value: r.id,
      label: `${r.name} (${formatDzd(r.salePriceCents, ctx.locale)})`,
    })),
  );
}
