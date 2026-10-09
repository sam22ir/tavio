import { and, desc, eq, ilike, inArray } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { taxes } from '@/modules/l10n_dz/schema';
import { products } from '@/modules/products/schema';
import { posSessions, type PosSession } from '../schema';

export interface SessionListRow {
  id: string;
  state: 'open' | 'closed';
  openedAt: Date;
  closedAt: Date | null;
  openingCashCents: bigint;
}

export async function listSessions(ctx: Ctx): Promise<Result<SessionListRow[]>> {
  const perm = requirePerm(ctx, 'pos.session.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({
      id: posSessions.id,
      state: posSessions.state,
      openedAt: posSessions.openedAt,
      closedAt: posSessions.closedAt,
      openingCashCents: posSessions.openingCashCents,
    })
    .from(posSessions)
    .where(eq(posSessions.companyId, ctx.companyId))
    .orderBy(desc(posSessions.openedAt))
    .limit(100);
  return ok(rows.map((r) => ({ ...r, state: r.state === 'closed' ? 'closed' : 'open' })));
}

export async function getSession(ctx: Ctx, sessionId: string): Promise<Result<PosSession>> {
  const perm = requirePerm(ctx, 'pos.session.read');
  if (!perm.ok) return perm;
  const [row] = await ctx.tx
    .select()
    .from(posSessions)
    .where(and(eq(posSessions.id, sessionId), eq(posSessions.companyId, ctx.companyId)));
  return row ? ok(row) : err('NOT_FOUND', 'SESSION_NOT_FOUND');
}

export interface ProductTile {
  id: string;
  name: string;
  priceCents: bigint;
  taxRate: string;            // percent of the default sale tax, "0" when none
}

/** Active products for the sale grid. The search is a case-insensitive prefix-free substring match. */
export async function sellableProducts(ctx: Ctx, search?: string): Promise<Result<ProductTile[]>> {
  const perm = requirePerm(ctx, 'pos.order.read');
  if (!perm.ok) return perm;
  const term = search?.trim().replace(/[%_\\]/g, '');
  const rows = await ctx.tx
    .select({ id: products.id, name: products.name, priceCents: products.salePriceCents, taxId: products.defaultTaxId })
    .from(products)
    .where(
      and(
        eq(products.companyId, ctx.companyId),
        eq(products.active, true),
        term ? ilike(products.name, `%${term}%`) : undefined,
      ),
    )
    .orderBy(products.name)
    .limit(200);
  const taxIds = rows.map((r) => r.taxId).filter((id): id is string => id !== null);
  const taxRows = taxIds.length
    ? await ctx.tx
        .select({ id: taxes.id, rate: taxes.rate })
        .from(taxes)
        .where(and(eq(taxes.companyId, ctx.companyId), inArray(taxes.id, taxIds)))
    : [];
  const rateById = new Map(taxRows.map((t) => [t.id, t.rate]));
  return ok(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      priceCents: r.priceCents,
      taxRate: (r.taxId && rateById.get(r.taxId)) || '0',
    })),
  );
}
