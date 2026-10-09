import { and, eq, sql } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { parseDzd } from '@/core/money';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { posOrders, posSessions, type PosSession } from '../schema';
import { expectedCash } from './totals';

export interface SessionReport {
  sessionId: string;
  state: 'open' | 'closed';
  openingCashCents: bigint;
  cashSalesCents: bigint;
  cardSalesCents: bigint;       // cib + edahabia
  orderCount: number;
  expectedCashCents: bigint;
  closingCashCents: bigint | null;
  differenceCents: bigint | null;
}

function toCents(input: string): bigint | null {
  return parseDzd(input);
}

/** Opens a session for the current user. Only one open session per company at a time. */
export async function openSession(
  ctx: Ctx,
  input: { openingCash: string },
): Promise<Result<{ sessionId: string }>> {
  const perm = requirePerm(ctx, 'pos.session.write');
  if (!perm.ok) return perm;

  const opening = toCents(input.openingCash);
  if (opening === null) return err('VALIDATION', 'INVALID_AMOUNT');

  // Serialise openings for this company so two tills cannot both open the same drawer.
  await ctx.tx.execute(sql`select pg_advisory_xact_lock(hashtext(${ctx.companyId}), hashtext('pos.session.open'))`);
  const [openRow] = await ctx.tx
    .select({ id: posSessions.id })
    .from(posSessions)
    .where(and(eq(posSessions.companyId, ctx.companyId), eq(posSessions.state, 'open')))
    .limit(1);
  if (openRow) return err('STATE', 'SESSION_ALREADY_OPEN', { sessionId: openRow.id });

  const [row] = await ctx.tx
    .insert(posSessions)
    .values({ companyId: ctx.companyId, openedBy: ctx.userId, openingCashCents: opening, state: 'open', createdBy: ctx.userId })
    .returning({ id: posSessions.id });
  if (!row) return err('INTERNAL', 'INSERT_FAILED');

  await audit(ctx, { action: 'create', entity: 'pos.session', recordId: row.id, after: { openingCashCents: opening } });
  return ok({ sessionId: row.id });
}

/** Totals of a session, read from its paid orders. */
export async function sessionReport(ctx: Ctx, sessionId: string): Promise<Result<SessionReport>> {
  const perm = requirePerm(ctx, 'pos.session.read');
  if (!perm.ok) return perm;

  const [session] = await ctx.tx
    .select()
    .from(posSessions)
    .where(and(eq(posSessions.id, sessionId), eq(posSessions.companyId, ctx.companyId)));
  if (!session) return err('NOT_FOUND', 'SESSION_NOT_FOUND');

  const sums = await ctx.tx
    .select({
      method: posOrders.method,
      total: sql<bigint>`coalesce(sum(${posOrders.totalCents}), 0)::bigint`,
      count: sql<number>`count(*)::int`,
    })
    .from(posOrders)
    .where(and(eq(posOrders.companyId, ctx.companyId), eq(posOrders.sessionId, sessionId)))
    .groupBy(posOrders.method);

  let cashSales = BigInt(0);
  let cardSales = BigInt(0);
  let orderCount = 0;
  for (const s of sums) {
    orderCount += Number(s.count);
    if (s.method === 'cash') cashSales += BigInt(s.total);
    else cardSales += BigInt(s.total);
  }

  return ok(buildReport(session, cashSales, cardSales, orderCount));
}

function buildReport(
  session: PosSession,
  cashSales: bigint,
  cardSales: bigint,
  orderCount: number,
): SessionReport {
  const expected = expectedCash(session.openingCashCents, cashSales);
  const closing = session.closingCashCents;
  return {
    sessionId: session.id,
    state: session.state === 'closed' ? 'closed' : 'open',
    openingCashCents: session.openingCashCents,
    cashSalesCents: cashSales,
    cardSalesCents: cardSales,
    orderCount,
    expectedCashCents: expected,
    closingCashCents: closing,
    differenceCents: closing === null ? null : closing - expected,
  };
}

/** Closes an open session with the counted cash. Returns the report, including the cash difference. */
export async function closeSession(
  ctx: Ctx,
  input: { sessionId: string; closingCash: string },
): Promise<Result<SessionReport>> {
  const perm = requirePerm(ctx, 'pos.session.write');
  if (!perm.ok) return perm;

  const closing = toCents(input.closingCash);
  if (closing === null) return err('VALIDATION', 'INVALID_AMOUNT');

  const [session] = await ctx.tx
    .select()
    .from(posSessions)
    .where(and(eq(posSessions.id, input.sessionId), eq(posSessions.companyId, ctx.companyId)))
    .for('update');
  if (!session) return err('NOT_FOUND', 'SESSION_NOT_FOUND');
  if (session.state !== 'open') return err('STATE', 'SESSION_NOT_OPEN');

  await ctx.tx
    .update(posSessions)
    .set({ state: 'closed', closedAt: sql`now()`, closingCashCents: closing, updatedAt: sql`now()` })
    .where(eq(posSessions.id, session.id));

  const report = await sessionReport(ctx, session.id);
  if (!report.ok) return report;

  await audit(ctx, {
    action: 'close',
    entity: 'pos.session',
    recordId: session.id,
    after: { closingCashCents: closing, differenceCents: closing - report.value.expectedCashCents },
  });
  return ok({ ...report.value, state: 'closed', closingCashCents: closing, differenceCents: closing - report.value.expectedCashCents });
}
