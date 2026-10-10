// Preferred suppliers per product (W13-PO). Used by the contract-to-order split.
import { and, asc, eq } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { partners } from '@/modules/contacts/schema';
import { products } from '@/modules/products/schema';
import { purchaseProductSuppliers } from '../schema';

export interface ProductSupplierRow {
  id: string;
  productName: string;
  partnerName: string;
  sequence: number;
  active: boolean;
}

export interface SupplierOption { value: string; label: string }

export interface ProductSupplierOptions {
  products: SupplierOption[];
  suppliers: SupplierOption[];
}

export interface AddProductSupplierInput {
  productId: string;
  partnerId: string;
  sequence: number;
}

/** Preferred-supplier rows for the settings list. */
export async function listProductSuppliers(ctx: Ctx): Promise<Result<ProductSupplierRow[]>> {
  const perm = requirePerm(ctx, 'purchases.order.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({
      id: purchaseProductSuppliers.id,
      productName: products.name,
      partnerName: partners.displayName,
      sequence: purchaseProductSuppliers.sequence,
      active: purchaseProductSuppliers.active,
    })
    .from(purchaseProductSuppliers)
    .innerJoin(products, eq(products.id, purchaseProductSuppliers.productId))
    .innerJoin(partners, eq(partners.id, purchaseProductSuppliers.partnerId))
    .where(eq(purchaseProductSuppliers.companyId, ctx.companyId))
    .orderBy(asc(products.name), asc(purchaseProductSuppliers.sequence));
  return ok(rows);
}

/** Active products and active suppliers for the form selects. */
export async function productSupplierOptions(ctx: Ctx): Promise<Result<ProductSupplierOptions>> {
  const perm = requirePerm(ctx, 'purchases.order.read');
  if (!perm.ok) return perm;
  const productRows = await ctx.tx
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(and(eq(products.companyId, ctx.companyId), eq(products.active, true)))
    .orderBy(asc(products.name))
    .limit(500);
  const supplierRows = await ctx.tx
    .select({ id: partners.id, name: partners.displayName })
    .from(partners)
    .where(and(eq(partners.companyId, ctx.companyId), eq(partners.active, true), eq(partners.isSupplier, true)))
    .orderBy(asc(partners.displayName))
    .limit(500);
  return ok({
    products: productRows.map((r) => ({ value: r.id, label: r.name })),
    suppliers: supplierRows.map((r) => ({ value: r.id, label: r.name })),
  });
}

/** Adds or updates the preferred supplier of a product (one row per product and supplier). */
export async function addProductSupplier(ctx: Ctx, input: AddProductSupplierInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'purchases.order.write');
  if (!perm.ok) return perm;
  if (!Number.isInteger(input.sequence) || input.sequence < 1 || input.sequence > 9999) {
    return err('VALIDATION', 'sequence must be between 1 and 9999');
  }
  const [product] = await ctx.tx
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, input.productId), eq(products.companyId, ctx.companyId)));
  if (!product) return err('NOT_FOUND', 'product not found');
  const [supplier] = await ctx.tx
    .select({ id: partners.id })
    .from(partners)
    .where(and(eq(partners.id, input.partnerId), eq(partners.companyId, ctx.companyId), eq(partners.isSupplier, true)));
  if (!supplier) return err('NOT_FOUND', 'supplier not found');

  const [row] = await ctx.tx
    .insert(purchaseProductSuppliers)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      productId: input.productId,
      partnerId: input.partnerId,
      sequence: input.sequence,
      active: true,
    })
    .onConflictDoUpdate({
      target: [purchaseProductSuppliers.companyId, purchaseProductSuppliers.productId, purchaseProductSuppliers.partnerId],
      set: { sequence: input.sequence, active: true, updatedAt: new Date() },
    })
    .returning({ id: purchaseProductSuppliers.id });
  if (!row) return err('INTERNAL', 'upsert failed');
  return ok({ id: row.id });
}
