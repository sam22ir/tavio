import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { dashboardKpis } from '@/core/dashboard/kpis';
import { formatDzd, type Cents } from '@/core/money';
import { err, ok, type Result } from '@/core/result';
import { partners } from '@/modules/contacts/schema';
import { listOverdue } from '@/modules/credit_sales/service/payments';
import { lowStock } from '@/modules/inventory/service/stock';
import { invoices } from '@/modules/invoicing/schema';
import { today } from '@/modules/invoicing/service/create';
import type { AssistantToolName } from './plan';

/** A small table shown under the answer. Every cell is a display string, so nothing non-serialisable leaves the server. */
export interface AssistantTable { title: string; columns: string[]; rows: string[][] }

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
      });
    }
    case 'top_customers_month': {
      const monthStart = `${today().slice(0, 8)}01`;
      const rows = await ctx.tx
        .select({
          name: partners.displayName,
          total: sql<string>`sum(${invoices.totalCents})::text`,
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
