import { and, asc, eq, sql } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { creditContracts, creditInstallments } from '@/modules/credit_sales/schema';

export interface DueItem {
  contractId: string;
  contractReference: string;
  seq: number;
  dueDate: string;
  remainingCents: bigint;
  daysLate: number;
}

/** Up to `limit` unpaid installments of active contracts that are due today or overdue, oldest first. */
export async function dueTodayAndOverdue(ctx: Ctx, limit = 5): Promise<DueItem[]> {
  const rows = await ctx.tx
    .select({
      contractId: creditContracts.id,
      contractReference: creditContracts.reference,
      seq: creditInstallments.seq,
      dueDate: creditInstallments.dueDate,
      remaining: sql<string>`${creditInstallments.amountCents} - ${creditInstallments.paidCents}`,
      daysLate: sql<string>`greatest(current_date - ${creditInstallments.dueDate}, 0)`,
    })
    .from(creditInstallments)
    .innerJoin(creditContracts, eq(creditContracts.id, creditInstallments.contractId))
    .where(
      and(
        eq(creditInstallments.companyId, ctx.companyId),
        eq(creditContracts.state, 'active'),
        sql`${creditInstallments.paidCents} < ${creditInstallments.amountCents}`,
        sql`${creditInstallments.dueDate} <= current_date`,
      ),
    )
    .orderBy(asc(creditInstallments.dueDate), asc(creditInstallments.seq))
    .limit(limit);

  return rows.map((r) => ({
    contractId: r.contractId,
    contractReference: r.contractReference,
    seq: r.seq,
    dueDate: r.dueDate,
    remainingCents: BigInt(r.remaining),
    daysLate: Number(r.daysLate),
  }));
}
