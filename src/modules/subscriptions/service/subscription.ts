import { eq } from 'drizzle-orm';
import type { Ctx } from '@/core/ctx';
import { companySubscriptions, saasPlans, type CompanySubscription, type SaasPlanRow } from '../schema';

export interface CurrentSubscription {
  subscription: CompanySubscription | null;
  plan: SaasPlanRow | null;
}

/** The company's subscription and plan. Both are null when the company has no row yet (treated as Free). */
export async function getCurrentSubscription(ctx: Ctx): Promise<CurrentSubscription> {
  const [row] = await ctx.tx
    .select({ subscription: companySubscriptions, plan: saasPlans })
    .from(companySubscriptions)
    .innerJoin(saasPlans, eq(saasPlans.id, companySubscriptions.planId))
    .where(eq(companySubscriptions.companyId, ctx.companyId))
    .limit(1);
  return row ? { subscription: row.subscription, plan: row.plan } : { subscription: null, plan: null };
}
