import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Ctx } from '@/core/ctx';
import type { Db } from '@/core/db/types';
import { memberships, roles } from '@/core/db/schema';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { partners } from '@/modules/contacts/schema';
import { createProduct, productInput } from '@/modules/products/service/products';
import { products } from '@/modules/products/schema';
import type { ApiScope } from './api-keys-crypto';

/** Maps a key's scopes to the permissions the services check. */
export const SCOPE_PERMS: Record<ApiScope, string> = {
  'contacts:read': 'contacts.partner.read',
  'products:read': 'products.product.read',
  'products:write': 'products.product.write',
  'invoices:read': 'invoicing.invoice.read',
};

export function permsForScopes(scopes: readonly ApiScope[]): Set<string> {
  return new Set(scopes.map((s) => SCOPE_PERMS[s]));
}

export const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PageQuery = z.infer<typeof pageQuery>;

/** Tenant context for an API key: the company's owner acts as the system user for reads and writes. */
export async function apiTenantArgs(
  db: Db,
  companyId: string,
  scopes: readonly ApiScope[],
): Promise<Result<{ userId: string; companyId: string; perms: Set<string>; locale: 'fr' }>> {
  const [owner] = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .where(and(eq(memberships.companyId, companyId), eq(roles.key, 'owner')))
    .limit(1);
  if (!owner) return err('FORBIDDEN', 'company has no owner');
  return ok({ userId: owner.userId, companyId, perms: permsForScopes(scopes), locale: 'fr' });
}


export interface ContactJson {
  id: string;
  kind: string;
  displayName: string;
  isCustomer: boolean;
  isSupplier: boolean;
  active: boolean;
  nif: string | null;
  nis: string | null;
  rc: string | null;
  phone: string | null;
  email: string | null;
  wilayaCode: string | null;
  custom: unknown;
}

// Safe public fields only: national_id and its hash, salesperson and income are never exposed.
export async function listContactsRest(ctx: Ctx, page: PageQuery): Promise<Result<ContactJson[]>> {
  const perm = requirePerm(ctx, 'contacts.partner.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({
      id: partners.id,
      kind: partners.kind,
      displayName: partners.displayName,
      isCustomer: partners.isCustomer,
      isSupplier: partners.isSupplier,
      active: partners.active,
      nif: partners.nif,
      nis: partners.nis,
      rc: partners.rc,
      phone: partners.phone,
      email: partners.email,
      wilayaCode: partners.wilayaCode,
      custom: partners.custom,
    })
    .from(partners)
    .where(eq(partners.companyId, ctx.companyId))
    .orderBy(asc(partners.displayName), asc(partners.id))
    .limit(page.limit)
    .offset(page.offset);
  return ok(rows);
}

export interface ProductJson {
  id: string;
  sku: string | null;
  name: string;
  kind: string;
  salePriceCents: string;
  costCents: string;
  active: boolean;
}

export async function listProductsRest(ctx: Ctx, page: PageQuery): Promise<Result<ProductJson[]>> {
  const perm = requirePerm(ctx, 'products.product.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      kind: products.kind,
      salePriceCents: products.salePriceCents,
      costCents: products.costCents,
      active: products.active,
    })
    .from(products)
    .where(eq(products.companyId, ctx.companyId))
    .orderBy(asc(products.name), asc(products.id))
    .limit(page.limit)
    .offset(page.offset);
  // bigint cents are serialised as decimal strings
  return ok(rows.map((r) => ({ ...r, salePriceCents: r.salePriceCents.toString(), costCents: r.costCents.toString() })));
}

/** Body: { name, kind, uomId, salePrice, cost, sku?, barcode?, description?, active? }. Prices are DZD strings. */
export const productBody = z.object({
  name: z.string().trim().min(1).max(200),
  kind: z.enum(['goods', 'service']),
  uomId: z.uuid(),
  salePrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  cost: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0'),
  sku: z.string().max(64).optional(),
  barcode: z.string().max(64).optional(),
  description: z.string().max(2000).optional(),
  active: z.boolean().default(true),
});

export async function createProductRest(ctx: Ctx, body: z.infer<typeof productBody>): Promise<Result<{ id: string }>> {
  const input = productInput.safeParse({
    name: body.name,
    nameAr: undefined,
    sku: body.sku,
    barcode: body.barcode,
    categoryId: undefined,
    kind: body.kind,
    uomId: body.uomId,
    salePriceCents: body.salePrice,
    costCents: body.cost,
    trackStock: false,
    active: body.active,
    description: body.description,
  });
  if (!input.success) return err('VALIDATION', 'invalid product');
  return createProduct(ctx, input.data);
}

export interface InvoiceJson {
  id: string;
  number: string | null;
  type: string;
  partnerId: string;
  state: string;
  date: string;
  untaxedCents: string;
  taxCents: string;
  stampCents: string;
  totalCents: string;
  paidCents: string;
  paymentState: string;
}

/**
 * Reads invoices owned by the invoicing module (W5-B). The table is referenced by name here because
 * platform must not import another Wave 5 schema. Remove this note when the integrator wires invoicing in.
 */
export async function listInvoicesRest(ctx: Ctx, page: PageQuery): Promise<Result<InvoiceJson[]>> {
  const perm = requirePerm(ctx, 'invoicing.invoice.read');
  if (!perm.ok) return perm;
  const result = await ctx.tx.execute(sql`
    select id, number, type, partner_id, state, date, untaxed_cents, tax_cents, stamp_cents,
           total_cents, paid_cents, payment_state
    from invoices
    where company_id = ${ctx.companyId}::uuid
    order by date desc, id asc
    limit ${page.limit} offset ${page.offset}
  `);
  const rows = result.rows as Record<string, unknown>[];
  return ok(
    rows.map((r) => ({
      id: String(r.id),
      number: (r.number as string | null) ?? null,
      type: String(r.type),
      partnerId: String(r.partner_id),
      state: String(r.state),
      date: String(r.date),
      untaxedCents: String(r.untaxed_cents),
      taxCents: String(r.tax_cents),
      stampCents: String(r.stamp_cents),
      totalCents: String(r.total_cents),
      paidCents: String(r.paid_cents),
      paymentState: String(r.payment_state),
    })),
  );
}
