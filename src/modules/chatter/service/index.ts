import { and, asc, desc, eq, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { emit } from '@/core/events';
import { err, ok, type Result } from '@/core/result';
import { ACTIVITY_TYPE_SEED } from '../entities';
import {
  activities,
  activityPlanSteps,
  activityPlans,
  activityTypes,
  messages,
  type ActivityPlan,
  type ActivityPlanStep,
  type ActivityType,
  type Activity,
  type Message,
} from '../schema';
import { isCheckViolation, isUniqueViolation } from './db-errors';
import { assertEntityAccess } from './access';
import { dueAfter, type DelayUnit } from './timing';

export interface NewActivity {
  entity: string;
  recordId: string;
  /** Seed key such as 'call'. Used by automation and sample data. Give exactly one of typeKey or activityTypeId. */
  typeKey?: string;
  /** Any active activity type of the company. */
  activityTypeId?: string;
  summary: string;
  dueDate: string;
  assigneeId?: string;
}

export interface CompleteOptions { result?: string; feedback?: string }

/** Next activity proposed by a completed activity whose type has chaining_type = suggest. */
export interface NextSuggestion { activityTypeId: string; summary: string; dueDate: string; assigneeId: string }

export interface CompleteResult { id: string; next: NextSuggestion | null; createdId: string | null }

export const ACTIVITY_CATEGORIES = ['default', 'phonecall', 'upload_file', 'meeting'] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export interface ActivityTypeInput {
  id?: string;
  name: string;
  entity: string | null;
  icon: string | null;
  delayCount: number;
  delayUnit: DelayUnit;
  category: ActivityCategory;
  chainingType: 'suggest' | 'trigger';
  nextTypeId: string | null;
  defaultUserId: string | null;
  requireResult: boolean;
  active: boolean;
}

export interface PlanStepInput {
  activityTypeId: string;
  summary: string;
  offsetDays: number;
  responsible: 'record_owner' | 'fixed';
  userId: string | null;
}

export interface PlanInput {
  id?: string;
  name: string;
  entity: string;
  active: boolean;
  steps: PlanStepInput[];
}

export type PlanWithSteps = { plan: ActivityPlan; steps: ActivityPlanStep[] };

export type ThreadItem =
  | { kind: 'message'; id: string; at: Date; message: Message }
  | { kind: 'activity'; id: string; at: Date; activity: Activity; typeName: string; requireResult: boolean };

export interface OpenActivity {
  id: string;
  entity: string;
  recordId: string;
  summary: string;
  dueDate: string;
  typeName: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BODY = 10000;
const MAX_SUMMARY = 200;
const MAX_THREAD = 200;
const MAX_RESULT = 100;
const MAX_NOTE = 1000;

/** Today's date (YYYY-MM-DD) in the company timezone. */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Algiers',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Every id must be an active member of the company (member_directory, see listAssignees). */
export async function assertMembers(ctx: Ctx, userIds: string[]): Promise<Result<void>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return ok(undefined);
  const members = new Set((await listAssignees(ctx)).map((m) => m.id));
  const missing = unique.filter((id) => !members.has(id));
  if (missing.length > 0) {
    return err('VALIDATION', 'User is not an active member of this company', { userIds: missing });
  }
  return ok(undefined);
}

/** Resolves a seed key (for example 'call') or an activity type id to an active activity_types row. */
async function resolveActivityType(
  ctx: Ctx,
  i: Pick<NewActivity, 'entity' | 'typeKey' | 'activityTypeId'>,
): Promise<Result<ActivityType>> {
  if (i.activityTypeId) {
    const [row] = await ctx.tx
      .select()
      .from(activityTypes)
      .where(and(eq(activityTypes.id, i.activityTypeId), eq(activityTypes.active, true)))
      .limit(1);
    if (!row) return err('NOT_FOUND', 'Activity type is not configured', { activityTypeId: i.activityTypeId });
    return ok(row);
  }
  if (!i.typeKey) return err('VALIDATION', 'Activity type is required');
  // activity_types.name holds the stable seed key (see core/tenancy/service.ts).
  const seed = ACTIVITY_TYPE_SEED.find((s) => s.key === i.typeKey);
  if (!seed) return err('VALIDATION', `Unknown activity type ${i.typeKey}`, { typeKey: i.typeKey });
  const rows = await ctx.tx
    .select()
    .from(activityTypes)
    .where(and(eq(activityTypes.name, seed.key), eq(activityTypes.active, true)));
  const row = rows.find((r) => r.entity === i.entity) ?? rows.find((r) => r.entity === null);
  if (!row) return err('NOT_FOUND', `Activity type ${i.typeKey} is not configured`, { typeKey: i.typeKey });
  return ok(row);
}

export async function postMessage(
  ctx: Ctx,
  i: { entity: string; recordId: string; body: string; kind?: 'comment' | 'note' | 'system' },
): Promise<Result<{ id: string }>> {
  const body = i.body.trim();
  if (!body) return err('VALIDATION', 'Message is empty');
  if (body.length > MAX_BODY) return err('VALIDATION', 'Message is too long');
  const access = await assertEntityAccess(ctx, i.entity, i.recordId);
  if (!access.ok) return access;
  const kind = i.kind ?? 'comment';
  const [row] = await ctx.tx
    .insert(messages)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      entity: i.entity,
      recordId: i.recordId,
      type: kind,
      body,
      isInternal: kind === 'note',
    })
    .returning({ id: messages.id });
  if (!row) return err('INTERNAL', 'insert failed');
  await audit(ctx, {
    entity: 'chatter.message',
    recordId: row.id,
    action: 'create',
    after: { entity: i.entity, recordId: i.recordId, type: kind },
  });
  return ok({ id: row.id });
}

/** Inserts one open activity. Callers check the type and the input first. */
export async function createActivity(
  ctx: Ctx,
  i: {
    entity: string;
    recordId: string;
    activityTypeId: string;
    summary: string;
    dueDate: string;
    assigneeId: string;
    planRunId?: string;
  },
): Promise<Result<{ id: string }>> {
  const access = await assertEntityAccess(ctx, i.entity, i.recordId);
  if (!access.ok) return access;
  const [row] = await ctx.tx
    .insert(activities)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      entity: i.entity,
      recordId: i.recordId,
      activityTypeId: i.activityTypeId,
      assigneeId: i.assigneeId,
      summary: i.summary,
      dueDate: i.dueDate,
      planRunId: i.planRunId ?? null,
    })
    .returning({ id: activities.id });
  if (!row) return err('INTERNAL', 'insert failed');
  await audit(ctx, {
    entity: 'chatter.activity',
    recordId: row.id,
    action: 'create',
    after: {
      entity: i.entity,
      recordId: i.recordId,
      activityTypeId: i.activityTypeId,
      dueDate: i.dueDate,
      assigneeId: i.assigneeId,
      planRunId: i.planRunId ?? null,
    },
  });
  return ok({ id: row.id });
}

export async function scheduleActivity(ctx: Ctx, i: NewActivity): Promise<Result<{ id: string }>> {
  const summary = i.summary.trim();
  if (!summary) return err('VALIDATION', 'Summary is empty');
  if (summary.length > MAX_SUMMARY) return err('VALIDATION', 'Summary is too long');
  if (!DATE_RE.test(i.dueDate)) return err('VALIDATION', 'Due date must be YYYY-MM-DD');
  if (Boolean(i.typeKey) === Boolean(i.activityTypeId)) {
    return err('VALIDATION', 'Give exactly one of typeKey or activityTypeId');
  }
  const type = await resolveActivityType(ctx, i);
  if (!type.ok) return type;
  return createActivity(ctx, {
    entity: i.entity,
    recordId: i.recordId,
    activityTypeId: type.value.id,
    summary,
    dueDate: i.dueDate,
    assigneeId: i.assigneeId ?? type.value.defaultUserId ?? ctx.userId,
  });
}

/**
 * Completes an open activity. Requires a result when the type says so.
 * chaining_type = trigger creates the next activity now; suggest returns it for the UI to pre-fill.
 */
export async function completeActivity(
  ctx: Ctx,
  id: string,
  opts: CompleteOptions = {},
): Promise<Result<CompleteResult>> {
  const [row] = await ctx.tx
    .select({ activity: activities, type: activityTypes })
    .from(activities)
    .innerJoin(activityTypes, eq(activities.activityTypeId, activityTypes.id))
    .where(eq(activities.id, id))
    .limit(1)
    .for('update', { of: activities });
  if (!row) return err('NOT_FOUND', 'Activity not found');
  const { activity: act, type } = row;
  const access = await assertEntityAccess(ctx, act.entity, act.recordId);
  if (!access.ok) return access;
  if (act.doneAt) return err('STATE', 'Activity is already done');

  const result = opts.result?.trim() || null;
  const note = opts.feedback?.trim() || null;
  if (type.requireResult && !result) return err('VALIDATION', 'A result is required for this activity');
  if (result && result.length > MAX_RESULT) return err('VALIDATION', 'Result is too long');
  if (note && note.length > MAX_NOTE) return err('VALIDATION', 'Note is too long');

  const doneAt = new Date();
  await ctx.tx
    .update(activities)
    .set({ doneAt, doneBy: ctx.userId, doneNote: note, result, updatedAt: doneAt })
    .where(eq(activities.id, id));
  await audit(ctx, {
    entity: 'chatter.activity',
    recordId: id,
    action: 'complete',
    before: { doneAt: null },
    after: { doneAt, doneNote: note, result },
  });

  let next: NextSuggestion | null = null;
  let createdId: string | null = null;
  if (type.nextTypeId) {
    const [nextType] = await ctx.tx
      .select()
      .from(activityTypes)
      .where(eq(activityTypes.id, type.nextTypeId))
      .limit(1);
    if (nextType?.active) {
      const suggestion: NextSuggestion = {
        activityTypeId: nextType.id,
        summary: act.summary,
        dueDate: dueAfter(todayIso(doneAt), nextType.delayCount, nextType.delayUnit as DelayUnit),
        assigneeId: nextType.defaultUserId ?? act.assigneeId,
      };
      if (type.chainingType === 'trigger') {
        const created = await createActivity(ctx, {
          entity: act.entity,
          recordId: act.recordId,
          ...suggestion,
        });
        if (!created.ok) return created;
        createdId = created.value.id;
      } else {
        next = suggestion;
      }
    }
  }

  await emit(ctx, {
    name: 'chatter.activity.done',
    payload: { activityId: id, entity: act.entity, recordId: act.recordId, activityTypeId: type.id, result },
  });
  const body = ['Activity done: ' + act.summary, result ? `Result: ${result}` : null, note]
    .filter((line): line is string => Boolean(line))
    .join('\n');
  const posted = await postMessage(ctx, { entity: act.entity, recordId: act.recordId, body, kind: 'system' });
  if (!posted.ok) return posted;
  return ok({ id, next, createdId });
}

/** Idempotent: does nothing if an open activity with the same entity, recordId, type and dueDate exists. */
export async function ensureActivity(ctx: Ctx, i: NewActivity): Promise<Result<{ id: string; created: boolean }>> {
  const access = await assertEntityAccess(ctx, i.entity, i.recordId);
  if (!access.ok) return access;
  const type = await resolveActivityType(ctx, i);
  if (!type.ok) return type;
  const [existing] = await ctx.tx
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(
        eq(activities.entity, i.entity),
        eq(activities.recordId, i.recordId),
        eq(activities.activityTypeId, type.value.id),
        eq(activities.dueDate, i.dueDate),
        isNull(activities.doneAt),
      ),
    )
    .limit(1);
  if (existing) return ok({ id: existing.id, created: false });
  const created = await scheduleActivity(ctx, i);
  if (!created.ok) return created;
  return ok({ id: created.value.id, created: true });
}

/** Messages and activities on one record, merged, newest first. */
export async function listThread(ctx: Ctx, entity: string, recordId: string): Promise<ThreadItem[]> {
  // Out of scope reads as an empty thread, so the record's existence is not revealed.
  if (!(await assertEntityAccess(ctx, entity, recordId)).ok) return [];
  const msgs = await ctx.tx
    .select()
    .from(messages)
    .where(and(eq(messages.entity, entity), eq(messages.recordId, recordId)))
    .orderBy(desc(messages.createdAt))
    .limit(MAX_THREAD);
  const acts = await ctx.tx
    .select({ activity: activities, typeName: activityTypes.name, requireResult: activityTypes.requireResult })
    .from(activities)
    .innerJoin(activityTypes, eq(activities.activityTypeId, activityTypes.id))
    .where(and(eq(activities.entity, entity), eq(activities.recordId, recordId)))
    .orderBy(desc(activities.createdAt))
    .limit(MAX_THREAD);
  const items: ThreadItem[] = [
    ...msgs.map((m): ThreadItem => ({ kind: 'message', id: m.id, at: m.createdAt, message: m })),
    ...acts.map(
      (a): ThreadItem => ({
        kind: 'activity',
        id: a.activity.id,
        at: a.activity.createdAt,
        activity: a.activity,
        typeName: a.typeName,
        requireResult: a.requireResult,
      }),
    ),
  ];
  return items.sort((x, y) => y.at.getTime() - x.at.getTime()).slice(0, MAX_THREAD);
}

/** The current user's open activities, earliest due first. */
export async function myOpenActivities(ctx: Ctx, limit: number): Promise<OpenActivity[]> {
  const rows = await ctx.tx
    .select({ activity: activities, typeName: activityTypes.name })
    .from(activities)
    .innerJoin(activityTypes, eq(activities.activityTypeId, activityTypes.id))
    .where(and(eq(activities.assigneeId, ctx.userId), isNull(activities.doneAt)))
    .orderBy(asc(activities.dueDate), asc(activities.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
  return rows.map((r) => ({
    id: r.activity.id,
    entity: r.activity.entity,
    recordId: r.activity.recordId,
    summary: r.activity.summary,
    dueDate: r.activity.dueDate,
    typeName: r.typeName,
  }));
}

/**
 * Number of open activities assigned to a user (default: the current user). With `overdue`, only
 * those whose due date is before today.
 */
export async function countOpenActivities(
  ctx: Ctx,
  opts: { overdue?: boolean; assigneeId?: string } = {},
): Promise<number> {
  const [row] = await ctx.tx
    .select({ n: sql<string>`count(*)` })
    .from(activities)
    .where(
      and(
        eq(activities.assigneeId, opts.assigneeId ?? ctx.userId),
        isNull(activities.doneAt),
        opts.overdue ? lt(activities.dueDate, todayIso()) : undefined,
      ),
    );
  return Number(row?.n ?? 0);
}

/** Active members of the company, for the activity assignee select. */
export async function listAssignees(ctx: Ctx): Promise<{ id: string; name: string }[]> {
  // users is not readable by tavio_app; member_directory is the tenant-scoped view of members.
  const rows = await ctx.tx
    .select({ id: sql<string>`member_directory.user_id`, name: sql<string>`member_directory.name` })
    .from(sql`member_directory`)
    .where(sql`member_directory.company_id = ${ctx.companyId} and member_directory.status = 'active'`)
    .orderBy(sql`member_directory.name`);
  return rows;
}

/** All activity types of the company, active or not, by name. */
export async function listActivityTypes(ctx: Ctx): Promise<ActivityType[]> {
  return ctx.tx.select().from(activityTypes).orderBy(asc(activityTypes.name));
}

/** Creates or updates an activity type. Keeps the legacy default_days column in step with the delay. */
export async function saveActivityType(ctx: Ctx, i: ActivityTypeInput): Promise<Result<{ id: string }>> {
  const name = i.name.trim();
  if (!name || name.length > 100) return err('VALIDATION', 'Name is required (max 100 characters)');
  if (!Number.isInteger(i.delayCount) || i.delayCount < 0 || i.delayCount > 3650) {
    return err('VALIDATION', 'Delay must be a whole number from 0 to 3650');
  }
  if (i.id && i.nextTypeId === i.id) return err('VALIDATION', 'An activity type cannot chain to itself');
  const entity = i.entity?.trim() || null;
  const isSeedKey = (n: string): boolean => ACTIVITY_TYPE_SEED.some((s) => s.key === n);

  let previous: ActivityType | undefined;
  if (i.id) {
    const [row] = await ctx.tx.select().from(activityTypes).where(eq(activityTypes.id, i.id)).limit(1);
    if (!row) return err('NOT_FOUND', 'Activity type not found');
    previous = row;
    // Seeded types are resolved by key (typeKey callers), so their name is fixed.
    if (isSeedKey(row.name) && name !== row.name) {
      return err('VALIDATION', 'Seeded activity types cannot be renamed', { name: row.name });
    }
  } else if (isSeedKey(name)) {
    return err('VALIDATION', 'This name is reserved for a seeded activity type', { name });
  }

  const sameName = await ctx.tx
    .select({ id: activityTypes.id })
    .from(activityTypes)
    .where(
      and(
        eq(activityTypes.name, name),
        entity === null ? isNull(activityTypes.entity) : eq(activityTypes.entity, entity),
        i.id ? ne(activityTypes.id, i.id) : undefined,
      ),
    )
    .limit(1);
  if (sameName.length > 0) return err('CONFLICT', 'An activity type with this name already exists for this entity');

  if (i.defaultUserId) {
    const members = await assertMembers(ctx, [i.defaultUserId]);
    if (!members.ok) return members;
  }
  if (i.nextTypeId) {
    const [next] = await ctx.tx
      .select({ id: activityTypes.id })
      .from(activityTypes)
      .where(eq(activityTypes.id, i.nextTypeId))
      .limit(1);
    if (!next) return err('NOT_FOUND', 'Next activity type not found');
  }
  const values = {
    name,
    entity,
    icon: i.icon,
    delayCount: i.delayCount,
    delayUnit: i.delayUnit,
    defaultDays: i.delayUnit === 'weeks' ? i.delayCount * 7 : i.delayCount,
    category: i.category,
    chainingType: i.chainingType,
    nextTypeId: i.nextTypeId,
    defaultUserId: i.defaultUserId,
    requireResult: i.requireResult,
    active: i.active,
    updatedAt: new Date(),
  };
  try {
    if (i.id) {
      const [row] = await ctx.tx
        .update(activityTypes)
        .set(values)
        .where(eq(activityTypes.id, i.id))
        .returning({ id: activityTypes.id });
      if (!row) return err('NOT_FOUND', 'Activity type not found');
      await audit(ctx, {
        entity: 'chatter.activity_type',
        recordId: row.id,
        action: 'update',
        before: previous ? { name: previous.name, entity: previous.entity, active: previous.active } : undefined,
        after: values,
      });
      return ok({ id: row.id });
    }
    const [row] = await ctx.tx
      .insert(activityTypes)
      .values({ ...values, companyId: ctx.companyId, createdBy: ctx.userId })
      .returning({ id: activityTypes.id });
    if (!row) return err('INTERNAL', 'insert failed');
    await audit(ctx, { entity: 'chatter.activity_type', recordId: row.id, action: 'create', after: values });
    return ok({ id: row.id });
  } catch (e) {
    if (isUniqueViolation(e)) return err('CONFLICT', 'An activity type with this name already exists for this entity');
    if (isCheckViolation(e)) return err('VALIDATION', 'Activity type values are invalid');
    throw e;
  }
}

/** All activity plans with their steps, by name. */
export async function listPlans(ctx: Ctx): Promise<PlanWithSteps[]> {
  const plans = await ctx.tx.select().from(activityPlans).orderBy(asc(activityPlans.name));
  if (plans.length === 0) return [];
  const steps = await ctx.tx
    .select()
    .from(activityPlanSteps)
    .where(inArray(activityPlanSteps.planId, plans.map((p) => p.id)))
    .orderBy(asc(activityPlanSteps.sequence));
  return plans.map((plan) => ({ plan, steps: steps.filter((s) => s.planId === plan.id) }));
}

/** Active plans that can be launched on one entity. */
export async function listPlansForEntity(ctx: Ctx, entity: string): Promise<ActivityPlan[]> {
  return ctx.tx
    .select()
    .from(activityPlans)
    .where(and(eq(activityPlans.entity, entity), eq(activityPlans.active, true)))
    .orderBy(asc(activityPlans.name));
}

/** Creates or updates a plan and replaces its steps. Runs already launched are not changed. */
export async function savePlan(ctx: Ctx, i: PlanInput): Promise<Result<{ id: string }>> {
  const name = i.name.trim();
  const entity = i.entity.trim();
  if (!name || name.length > 100) return err('VALIDATION', 'Name is required (max 100 characters)');
  if (!entity || entity.length > 100) return err('VALIDATION', 'Entity is required');
  if (i.steps.length === 0 || i.steps.length > 50) return err('VALIDATION', 'A plan needs 1 to 50 steps');
  for (const s of i.steps) {
    if (!s.summary.trim() || s.summary.trim().length > MAX_SUMMARY) return err('VALIDATION', 'Step summary is required');
    if (!Number.isInteger(s.offsetDays) || Math.abs(s.offsetDays) > 3650) {
      return err('VALIDATION', 'Step offset must be a whole number of days');
    }
    if (s.responsible === 'fixed' && !s.userId) return err('VALIDATION', 'A fixed step needs a user');
    if (s.responsible === 'record_owner' && s.userId) return err('VALIDATION', 'A record owner step cannot have a user');
  }
  const members = await assertMembers(
    ctx,
    i.steps.flatMap((s) => (s.responsible === 'fixed' && s.userId ? [s.userId] : [])),
  );
  if (!members.ok) return members;
  const typeIds = [...new Set(i.steps.map((s) => s.activityTypeId))];
  const types = await ctx.tx
    .select({ id: activityTypes.id })
    .from(activityTypes)
    .where(inArray(activityTypes.id, typeIds));
  if (types.length !== typeIds.length) return err('NOT_FOUND', 'An activity type in the plan was not found');

  const values = { name, entity, active: i.active, updatedAt: new Date() };
  let planId: string;
  try {
    if (i.id) {
      const [row] = await ctx.tx
        .update(activityPlans)
        .set(values)
        .where(eq(activityPlans.id, i.id))
        .returning({ id: activityPlans.id });
      if (!row) return err('NOT_FOUND', 'Plan not found');
      planId = row.id;
      await ctx.tx.delete(activityPlanSteps).where(eq(activityPlanSteps.planId, planId));
    } else {
      const [row] = await ctx.tx
        .insert(activityPlans)
        .values({ ...values, companyId: ctx.companyId, createdBy: ctx.userId })
        .returning({ id: activityPlans.id });
      if (!row) return err('INTERNAL', 'insert failed');
      planId = row.id;
    }
    await ctx.tx.insert(activityPlanSteps).values(
      i.steps.map((s, index) => ({
        companyId: ctx.companyId,
        createdBy: ctx.userId,
        planId,
        sequence: index + 1,
        activityTypeId: s.activityTypeId,
        summary: s.summary.trim(),
        offsetDays: s.offsetDays,
        responsible: s.responsible,
        userId: s.responsible === 'fixed' ? s.userId : null,
      })),
    );
  } catch (e) {
    if (isUniqueViolation(e)) return err('CONFLICT', 'A plan with these values already exists');
    if (isCheckViolation(e)) return err('VALIDATION', 'Plan values are invalid');
    throw e;
  }
  await audit(ctx, {
    entity: 'chatter.activity_plan',
    recordId: planId,
    action: i.id ? 'update' : 'create',
    after: { ...values, steps: i.steps.length },
  });
  return ok({ id: planId });
}

export * from './access';
