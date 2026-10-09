import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { companies } from '@/core/db/schema/tenancy';
import { partners } from '@/modules/contacts/schema';
import { taxes } from '@/modules/l10n_dz/schema';
import { invoices, invoicePayments } from './schema';
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

export async function taxOptionsFor(ctx: Ctx, kind: Kind): Promise<{ id: string; name: string }[]> {
  const scopes = kind === 'customers' ? ['sale', 'both'] : ['purchase', 'both'];
  return ctx.tx
    .select({ id: taxes.id, name: taxes.name })
    .from(taxes)
    .where(and(eq(taxes.companyId, ctx.companyId), eq(taxes.active, true), inArray(taxes.scope, scopes)));
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

