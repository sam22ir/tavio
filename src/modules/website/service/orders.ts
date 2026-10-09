import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import type { ListQuery, ListResult } from '@/core/entities/types';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { webOrders, type WebOrder } from '../schema';
import { nextOrderState, type OrderStateAction, type WebOrderState } from './rules';

const MAX_PAGE_SIZE = 100;

export interface WebOrderLine {
  productId: string;
  name: string;
  unitPriceCents: string;
  quantity: number;
  subtotalCents: string;
}

/** Web order as returned to callers. Money is a string of cents so the row is serializable. */
export type WebOrderRow = Omit<WebOrder, 'totalCents' | 'lines'> & {
  totalCents: string;
  lines: WebOrderLine[];
};

export function toWebOrderRow(row: WebOrder): WebOrderRow {
  return {
    ...row,
    totalCents: row.totalCents.toString(),
    lines: Array.isArray(row.lines) ? (row.lines as WebOrderLine[]) : [],
  };
}

export async function listWebOrders(ctx: Ctx, query: ListQuery): Promise<Result<ListResult<WebOrderRow>>> {
  const perm = requirePerm(ctx, 'website.order.read');
  if (!perm.ok) return perm;

  const conditions: SQL[] = [eq(webOrders.companyId, ctx.companyId)];
  const state = query.filters.state;
  if (state === 'new' || state === 'confirmed' || state === 'cancelled') {
    conditions.push(eq(webOrders.state, state));
  }
  const wilaya = query.filters.wilayaCode;
  if (wilaya) conditions.push(eq(webOrders.wilayaCode, wilaya));
  const q = query.q?.trim();
  if (q) {
    const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const search = or(
      ilike(webOrders.number, pattern),
      ilike(webOrders.customerName, pattern),
      ilike(webOrders.phone, pattern),
    );
    if (search) conditions.push(search);
  }
  const where = and(...conditions);

  const pageSize = Math.min(Math.max(query.pageSize, 1), MAX_PAGE_SIZE);
  const page = Math.max(query.page, 1);

  const [totalRow] = await ctx.tx.select({ total: count() }).from(webOrders).where(where);
  const rows = await ctx.tx
    .select()
    .from(webOrders)
    .where(where)
    .orderBy(desc(webOrders.createdAt), desc(webOrders.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return ok({ rows: rows.map(toWebOrderRow), total: Number(totalRow?.total ?? 0), page, pageSize });
}

export async function getWebOrder(ctx: Ctx, id: string): Promise<Result<WebOrderRow>> {
  const perm = requirePerm(ctx, 'website.order.read');
  if (!perm.ok) return perm;
  const [row] = await ctx.tx
    .select()
    .from(webOrders)
    .where(and(eq(webOrders.id, id), eq(webOrders.companyId, ctx.companyId)))
    .limit(1);
  if (!row) return err('NOT_FOUND', 'web order not found');
  return ok(toWebOrderRow(row));
}

/**
 * Moves a web order on. "confirm" is the admin Convert button: it only marks the order confirmed.
 * It does not create a sale order, because a direct call into sales is not allowed.
 */
export async function transitionWebOrder(
  ctx: Ctx,
  id: string,
  action: OrderStateAction,
): Promise<Result<{ state: WebOrderState }>> {
  const perm = requirePerm(ctx, 'website.order.write');
  if (!perm.ok) return perm;

  const [row] = await ctx.tx
    .select()
    .from(webOrders)
    .where(and(eq(webOrders.id, id), eq(webOrders.companyId, ctx.companyId)))
    .for('update');
  if (!row) return err('NOT_FOUND', 'web order not found');

  const current = row.state as WebOrderState;
  const next = nextOrderState(current, action);
  if (!next) return err('STATE', `web order is ${current}`);

  await ctx.tx
    .update(webOrders)
    .set({ state: next, updatedAt: new Date() })
    .where(eq(webOrders.id, id));
  await audit(ctx, {
    action: action === 'confirm' ? 'confirm' : 'cancel',
    entity: 'website.web_order',
    recordId: id,
    before: { state: current },
    after: { state: next },
  });
  return ok({ state: next });
}
