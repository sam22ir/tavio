import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { dashboardKpis } from '@/core/dashboard/kpis';
import { formatDzd, type Cents } from '@/core/money';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { partners } from '@/modules/contacts/schema';
import { creditClientScores } from '@/modules/credit_sales/schema';
import { listOverdue } from '@/modules/credit_sales/service/payments';
import { lowStock } from '@/modules/inventory/service/stock';
import { invoices } from '@/modules/invoicing/schema';
import { today } from '@/modules/invoicing/service/create';
import type { AssistantToolName } from './plan';

/**
 * A small table shown under the answer. Every cell is a display string, so nothing non-serialisable leaves the server.
 * `ids` is optional and parallel to `rows`: one object per row with the real IDs behind it. The planner may only
 * name IDs from here, so they are never invented.
 */
export interface AssistantTable {
  title: string;
  columns: string[];
  rows: string[][];
  ids?: Record<string, string | string[]>[];
}

const money = (raw: string | number | bigint, ctx: Ctx): string => formatDzd(BigInt(raw) as Cents, ctx.locale);

/** Read-only queries. Each runs inside the caller's tenant transaction and never writes. */
export async function runAssistantTool(ctx: Ctx, name: AssistantToolName): Promise<Result<AssistantTable>> {
  switch (name) {
    case 'kpis': {
      const k = await dashboardKpis(ctx);
      return ok({
        title: 'KPIs',
        columns: ['metric', 'value'],
        rows: [
          ['overdue', money(k.overdueCents, ctx)],
          ['overdue_count', String(k.overdueCount)],
          ['due_today', money(k.dueTodayCents, ctx)],
          ['collected_this_month', money(k.collectedThisMonthCents, ctx)],
          ['active_contracts', String(k.activeContracts)],
          ['open_leads', String(k.openLeads)],
        ],
      });
    }
    case 'overdue': {
      const rows = await listOverdue(ctx, { limit: 20 });
      return ok({
        title: 'Overdue',
        columns: ['contract', 'partner', 'due_date', 'days_late', 'amount'],
        rows: rows.map((r) => [r.contractNumber, r.partnerName, r.dueDate, String(r.daysLate), money(r.dueCents, ctx)]),
        ids: rows.map((r) => ({ contractId: r.contractId, partnerId: r.partnerId })),
      });
    }
    case 'top_customers_month': {
      const monthStart = `${today().slice(0, 8)}01`;
      const rows = await ctx.tx
        .select({
          name: partners.displayName,
          total: sql<string>`sum(${invoices.totalCents})::text`,
          partnerId: partners.id,
        })
        .from(invoices)
        .innerJoin(partners, eq(partners.id, invoices.partnerId))
        .where(
          and(
            eq(invoices.companyId, ctx.companyId),
            eq(invoices.type, 'out_invoice'),
            eq(invoices.state, 'posted'),
            gte(invoices.date, monthStart),
          ),
        )
        .groupBy(partners.id, partners.displayName)
        .orderBy(desc(sql`sum(${invoices.totalCents})`))
        .limit(5);
      return ok({
        title: 'Top customers this month',
        columns: ['customer', 'total'],
        rows: rows.map((r) => [r.name, money(r.total, ctx)]),
        ids: rows.map((r) => ({ partnerId: r.partnerId })),
      });
    }
    case 'low_stock': {
      const res = await lowStock(ctx);
      if (!res.ok) return res;
      return ok({
        title: 'Low stock',
        columns: ['product', 'warehouse', 'on_hand', 'min'],
        rows: res.value.slice(0, 30).map((r) => [r.productName, r.warehouseName, r.onHand, r.minQty]),
      });
    }
    case 'collections_queue': {
      const perm = requirePerm(ctx, 'credit_sales.contract.read');
      if (!perm.ok) return perm;
      const overdue = await listOverdue(ctx, { limit: 500 });
      // Group installments by customer, then rank: most days late first, then larger amount first.
      const groups = new Map<string, { partnerId: string; partnerName: string; contractIds: Set<string>; installments: number; dueCents: bigint; maxDaysLate: number }>();
      for (const r of overdue) {
        let g = groups.get(r.partnerId);
        if (!g) {
          g = { partnerId: r.partnerId, partnerName: r.partnerName, contractIds: new Set(), installments: 0, dueCents: BigInt(0), maxDaysLate: 0 };
          groups.set(r.partnerId, g);
        }
        g.contractIds.add(r.contractId);
        g.installments += 1;
        g.dueCents += r.dueCents;
        g.maxDaysLate = Math.max(g.maxDaysLate, r.daysLate);
      }
      const queue = [...groups.values()]
        .sort((a, b) => b.maxDaysLate - a.maxDaysLate || (a.dueCents > b.dueCents ? -1 : a.dueCents < b.dueCents ? 1 : 0))
        .slice(0, 20);
      // Reads the latest stored band per customer. Scores are not recomputed here.
      const bands = await latestBands(ctx, queue.map((g) => g.partnerId));
      return ok({
        title: 'Collections queue',
        columns: ['customer', 'overdue_installments', 'amount', 'days_late', 'risk'],
        rows: queue.map((g) => [g.partnerName, String(g.installments), money(g.dueCents, ctx), String(g.maxDaysLate), bands.get(g.partnerId) ?? 'new']),
        ids: queue.map((g) => ({ partnerId: g.partnerId, contractIds: [...g.contractIds] })),
      });
    }
    case 'unpaid_invoices': {
      const [row] = await ctx.tx
        .select({
          total: sql<string>`coalesce(sum(${invoices.totalCents} - ${invoices.paidCents}), 0)::text`,
          count: sql<number>`count(*)::int`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.companyId, ctx.companyId),
            eq(invoices.type, 'out_invoice'),
            eq(invoices.state, 'posted'),
            sql`${invoices.paymentState} <> 'paid'`,
          ),
        );
      if (!row) return err('INTERNAL', 'unpaid query returned no row');
      return ok({
        title: 'Unpaid invoices',
        columns: ['count', 'outstanding'],
        rows: [[String(row.count), money(row.total, ctx)]],
      });
    }
  }
}

/** Latest stored risk band per partner (one row each, newest computed_at wins). Partners never scored are absent. */
async function latestBands(ctx: Ctx, partnerIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (partnerIds.length === 0) return out;
  const rows = await ctx.tx
    .selectDistinctOn([creditClientScores.partnerId], {
      partnerId: creditClientScores.partnerId,
      band: creditClientScores.band,
    })
    .from(creditClientScores)
    .where(and(eq(creditClientScores.companyId, ctx.companyId), inArray(creditClientScores.partnerId, partnerIds)))
    .orderBy(creditClientScores.partnerId, desc(creditClientScores.computedAt));
  for (const r of rows) out.set(r.partnerId, r.band);
  return out;
}
