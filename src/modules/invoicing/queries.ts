import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { companies } from '@/core/db/schema/tenancy';
import { partners } from '@/modules/contacts/schema';
import { products } from '@/modules/products/schema';
import { taxes } from '@/modules/l10n_dz/schema';
import { invoices, invoicePayments } from './schema';
import { fileUrl } from '@/core/files/service';
import type { DraftLookups } from './ui/draft-form-defaults';
import type { Kind, ListRow } from './ui/views';

const TYPES: Record<Kind, string[]> = {
  customers: ['out_invoice', 'out_refund'],
  vendors: ['in_invoice', 'in_refund'],
};

export async function listInvoices(ctx: Ctx, kind: Kind): Promise<ListRow[]> {
  const rows = await ctx.tx
    .select({
      id: invoices.id,
      number: invoices.number,
      date: invoices.date,
      totalCents: invoices.totalCents,
      state: invoices.state,
      paymentState: invoices.paymentState,
      type: invoices.type,
      partnerName: partners.displayName,
    })
    .from(invoices)
    .innerJoin(partners, eq(partners.id, invoices.partnerId))
    .where(and(eq(invoices.companyId, ctx.companyId), inArray(invoices.type, TYPES[kind])))
    .orderBy(desc(invoices.date), desc(invoices.createdAt))
    .limit(200);
  return rows.map((r) => ({ ...r, date: String(r.date) }));
}

export async function partnerOptionsFor(ctx: Ctx, kind: Kind): Promise<{ id: string; name: string }[]> {
  const role = kind === 'customers' ? partners.isCustomer : partners.isSupplier;
  const rows = await ctx.tx
    .select({ id: partners.id, name: partners.displayName })
    .from(partners)
    .where(and(eq(partners.companyId, ctx.companyId), eq(role, true), eq(partners.active, true)))
    .orderBy(partners.displayName)
    .limit(500);
  return rows;
}

/** Line taxes (TVA etc.). Retenue à la source is set on the bill, so it is excluded here. */
export async function taxOptionsFor(ctx: Ctx, kind: Kind): Promise<{ id: string; name: string; rate: string }[]> {
  const scopes = kind === 'customers' ? ['sale', 'both'] : ['purchase', 'both'];
  const rows = await ctx.tx
    .select({ id: taxes.id, name: taxes.name, rate: taxes.rate })
    .from(taxes)
    .where(and(eq(taxes.companyId, ctx.companyId), eq(taxes.active, true), inArray(taxes.scope, scopes), ne(taxes.kind, 'retenue_source')));
  return rows.map((r) => ({ id: r.id, name: r.name, rate: String(r.rate) }));
}

/** Retenue à la source options for vendor bills. Empty for customer documents. ⚠ needs accountant verification */
export async function withholdingTaxOptionsFor(ctx: Ctx, kind: Kind): Promise<{ id: string; name: string; rate: string }[]> {
  if (kind !== 'vendors') return [];
  const rows = await ctx.tx
    .select({ id: taxes.id, name: taxes.name, rate: taxes.rate })
    .from(taxes)
    .where(and(eq(taxes.companyId, ctx.companyId), eq(taxes.active, true), eq(taxes.kind, 'retenue_source'), inArray(taxes.scope, ['purchase', 'both'])));
  return rows.map((r) => ({ id: r.id, name: r.name, rate: String(r.rate) }));
}

/** Active products for the line editor. Price is the sale price for both customer and vendor documents. */
export async function productOptionsFor(ctx: Ctx): Promise<{ id: string; name: string; unitPriceCents: string; defaultTaxId: string | null }[]> {
  const rows = await ctx.tx
    .select({ id: products.id, name: products.name, salePriceCents: products.salePriceCents, defaultTaxId: products.defaultTaxId })
    .from(products)
    .where(and(eq(products.companyId, ctx.companyId), eq(products.active, true)))
    .orderBy(products.name)
    .limit(500);
  return rows.map((r) => ({ id: r.id, name: r.name, unitPriceCents: r.salePriceCents.toString(), defaultTaxId: r.defaultTaxId }));
}

export async function partnerNameOf(ctx: Ctx, partnerId: string): Promise<string> {
  const [p] = await ctx.tx
    .select({ name: partners.displayName })
    .from(partners)
    .where(and(eq(partners.companyId, ctx.companyId), eq(partners.id, partnerId)));
  return p?.name ?? '';
}

export async function paymentsOf(ctx: Ctx, invoiceId: string) {
  return ctx.tx
    .select()
    .from(invoicePayments)
    .where(and(eq(invoicePayments.companyId, ctx.companyId), eq(invoicePayments.invoiceId, invoiceId)))
    .orderBy(desc(invoicePayments.date));
}

/** Seller identity from the company row, for print. */
export async function sellerOf(ctx: Ctx) {
  const [c] = await ctx.tx.select().from(companies).where(eq(companies.id, ctx.companyId));
  return c ? { name: c.legalName, nif: c.nif, nis: c.nis, rc: c.rc, ai: c.ai, address: c.address } : null;
}

export async function partnerIdentity(ctx: Ctx, partnerId: string) {
  const [p] = await ctx.tx
    .select({ name: partners.displayName, nif: partners.nif, nis: partners.nis, rc: partners.rc, ai: partners.ai, address: partners.address })
    .from(partners)
    .where(and(eq(partners.companyId, ctx.companyId), eq(partners.id, partnerId)));
  return p ?? null;
}


/** Plain lookup data for the draft line editor. Passed from server pages to the client form as data only. */
export async function draftLookupsFor(ctx: Ctx, kind: Kind): Promise<DraftLookups> {
  const [partners, taxes, withholdingTaxes, products] = await Promise.all([
    partnerOptionsFor(ctx, kind),
    taxOptionsFor(ctx, kind),
    withholdingTaxOptionsFor(ctx, kind),
    productOptionsFor(ctx),
  ]);
  return {
    partners: partners.map((p) => ({ value: p.id, label: p.name })),
    taxes: taxes.map((x) => ({ value: x.id, label: x.name, rate: x.rate })),
    withholdingTaxes: withholdingTaxes.map((x) => ({ value: x.id, label: x.name, rate: x.rate })),
    products: products.map((p) => ({ value: p.id, label: p.name, unitPrice: p.unitPriceCents, defaultTaxId: p.defaultTaxId })),
  };
}

/** Full legal identity of the selling company, for printed documents. */
export async function companyIdentityOf(ctx: Ctx) {
  const [c] = await ctx.tx.select().from(companies).where(eq(companies.id, ctx.companyId));
  if (!c) return null;
  const logo = c.logoFileId ? await fileUrl(ctx, c.logoFileId) : null;
  return {
    legalName: c.legalName,
    rib: c.rib,
    ccp: c.ccp,
    address: c.address,
    wilaya: c.wilayaCode,
    phone: c.phone,
    email: c.email,
    nif: c.nif,
    nis: c.nis,
    rc: c.rc,
    ai: c.ai,
    logoUrl: logo && logo.ok ? logo.value : null,
  };
}

/** One payment with its invoice and payer, for the receipt print. Null when not found in this company. */
export async function paymentReceiptOf(ctx: Ctx, paymentId: string) {
  const [row] = await ctx.tx
    .select({ payment: invoicePayments, invoice: invoices, partnerName: partners.displayName })
    .from(invoicePayments)
    .innerJoin(invoices, eq(invoices.id, invoicePayments.invoiceId))
    .innerJoin(partners, eq(partners.id, invoices.partnerId))
    .where(and(eq(invoicePayments.companyId, ctx.companyId), eq(invoicePayments.id, paymentId)));
  if (!row) return null;
  const paidToDate = await ctx.tx
    .select({ amountCents: invoicePayments.amountCents })
    .from(invoicePayments)
    .where(and(eq(invoicePayments.companyId, ctx.companyId), eq(invoicePayments.invoiceId, row.invoice.id)));
  return {
    payment: row.payment,
    invoice: row.invoice,
    partnerName: row.partnerName,
    paidToDateCents: paidToDate.reduce((acc, r) => acc + r.amountCents, BigInt(0)),
  };
}
