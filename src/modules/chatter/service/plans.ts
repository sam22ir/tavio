import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { err, ok, type Result } from '@/core/result';
import { activities, activityPlanRuns, activityPlanSteps, activityPlans } from '../schema';
import { assertMembers, createActivity } from './index';
import { assertEntityAccess } from './access';
import { addDays } from './timing';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Launches an active plan on a record. Each step becomes an open activity due startDate + offset_days.
 * Steps with responsible = record_owner go to ownerId; fixed steps go to their user.
 */
export async function launchPlan(
  ctx: Ctx,
  planId: string,
  entity: string,
  recordId: string,
  startDate: string,
  ownerId: string | null,
): Promise<Result<{ runId: string; activityIds: string[] }>> {
  if (!DATE_RE.test(startDate)) return err('VALIDATION', 'Start date must be YYYY-MM-DD');
  const access = await assertEntityAccess(ctx, entity, recordId);
  if (!access.ok) return access;
  const [plan] = await ctx.tx
    .select()
    .from(activityPlans)
    .where(and(eq(activityPlans.id, planId), eq(activityPlans.active, true)))
    .limit(1);
  if (!plan) return err('NOT_FOUND', 'Activity plan not found or inactive');
  if (plan.entity !== entity) return err('VALIDATION', 'Plan is for another entity', { entity: plan.entity });

  const steps = await ctx.tx
    .select()
    .from(activityPlanSteps)
    .where(eq(activityPlanSteps.planId, planId))
    .orderBy(asc(activityPlanSteps.sequence));
  if (steps.length === 0) return err('VALIDATION', 'Plan has no steps');
  if (steps.some((s) => s.responsible === 'record_owner') && !ownerId) {
    return err('VALIDATION', 'The plan needs a record owner');
  }
  // Owner and fixed users must be active members of this company.
  const members = await assertMembers(ctx, [
    ...(ownerId ? [ownerId] : []),
    ...steps.flatMap((s) => (s.responsible === 'fixed' && s.userId ? [s.userId] : [])),
  ]);
  if (!members.ok) return members;

  const [run] = await ctx.tx
    .insert(activityPlanRuns)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      planId,
      entity,
      recordId,
      startDate,
      ownerId,
    })
    .returning({ id: activityPlanRuns.id });
  if (!run) return err('INTERNAL', 'insert failed');

  const activityIds: string[] = [];
  for (const step of steps) {
    const assigneeId = step.responsible === 'fixed' ? step.userId : ownerId;
    if (!assigneeId) return err('VALIDATION', 'Plan step has no assignee');
    const created = await createActivity(ctx, {
      entity,
      recordId,
      activityTypeId: step.activityTypeId,
      summary: step.summary,
      dueDate: addDays(startDate, step.offsetDays),
      assigneeId,
      planRunId: run.id,
    });
    if (!created.ok) return created;
    activityIds.push(created.value.id);
  }
  await audit(ctx, {
    entity: 'chatter.activity_plan_run',
    recordId: run.id,
    action: 'create',
    after: { planId, entity, recordId, startDate, activities: activityIds.length },
  });
  return ok({ runId: run.id, activityIds });
}

/**
 * Cancels the earlier plan runs on a record: deletes their open activities and sets cancelled_at.
 * Done activities stay. The run named by exceptRunId is left alone.
 */
export async function cancelPlanRuns(
  ctx: Ctx,
  entity: string,
  recordId: string,
  opts: { exceptRunId?: string } = {},
): Promise<Result<{ cancelledRuns: number; deletedActivities: number }>> {
  const access = await assertEntityAccess(ctx, entity, recordId);
  if (!access.ok) return access;
  const conditions = [
    eq(activityPlanRuns.entity, entity),
    eq(activityPlanRuns.recordId, recordId),
    isNull(activityPlanRuns.cancelledAt),
  ];
  const runs = await ctx.tx
    .select({ id: activityPlanRuns.id })
    .from(activityPlanRuns)
    .where(and(...conditions));
  const runIds = runs.map((r) => r.id).filter((id) => id !== opts.exceptRunId);
  if (runIds.length === 0) return ok({ cancelledRuns: 0, deletedActivities: 0 });

  const deleted = await ctx.tx
    .delete(activities)
    .where(and(inArray(activities.planRunId, runIds), isNull(activities.doneAt)))
    .returning({ id: activities.id, planRunId: activities.planRunId });
  const now = new Date();
  await ctx.tx
    .update(activityPlanRuns)
    .set({ cancelledAt: now, updatedAt: now })
    .where(inArray(activityPlanRuns.id, runIds));
  // One audit entry per cancelled run, listing the activities deleted from it.
  for (const runId of runIds) {
    const deletedIds = deleted.filter((d) => d.planRunId === runId).map((d) => d.id);
    await audit(ctx, {
      entity: 'chatter.activity_plan_run',
      recordId: runId,
      action: 'cancel',
      before: { cancelledAt: null },
      after: { cancelledAt: now, deletedActivityIds: deletedIds },
    });
  }
  return ok({ cancelledRuns: runIds.length, deletedActivities: deleted.length });
}
