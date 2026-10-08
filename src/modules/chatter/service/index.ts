import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { memberships, users } from '@/core/db/schema';
import { err, ok, type Result } from '@/core/result';
import { ACTIVITY_TYPE_SEED } from '../entities';
import { activities, activityTypes, messages, type Activity, type Message } from '../schema';

export interface NewActivity { entity: string; recordId: string; typeKey: string; summary: string; dueDate: string; assigneeId?: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BODY = 10000;
const MAX_SUMMARY = 200;
const MAX_THREAD = 200;

export type ThreadItem =
  | { kind: 'message'; id: string; at: Date; message: Message }
  | { kind: 'activity'; id: string; at: Date; activity: Activity; typeName: string };

export interface OpenActivity {
  id: string;
  entity: string;
  recordId: string;
  summary: string;
  dueDate: string;
  typeName: string;
}

/** Today's date (YYYY-MM-DD) in the company timezone. */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Algiers',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Resolves a seed key (for example 'call') to the company's activity_types row. */
async function resolveActivityTypeId(ctx: Ctx, typeKey: string, entity: string): Promise<Result<string>> {
  const seed = ACTIVITY_TYPE_SEED.find((s) => s.key === typeKey);
  if (!seed) return err('VALIDATION', `Unknown activity type ${typeKey}`, { typeKey });
  const rows = await ctx.tx
    .select({ id: activityTypes.id, entity: activityTypes.entity })
    .from(activityTypes)
    .where(and(eq(activityTypes.name, seed.name), eq(activityTypes.active, true)));
  const row = rows.find((r) => r.entity === entity) ?? rows.find((r) => r.entity === null);
  if (!row) return err('NOT_FOUND', `Activity type ${typeKey} is not configured`, { typeKey });
  return ok(row.id);
}

export async function postMessage(
  ctx: Ctx,
  i: { entity: string; recordId: string; body: string; kind?: 'comment' | 'note' | 'system' },
): Promise<Result<{ id: string }>> {
  const body = i.body.trim();
  if (!body) return err('VALIDATION', 'Message is empty');
  if (body.length > MAX_BODY) return err('VALIDATION', 'Message is too long');
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

export async function scheduleActivity(ctx: Ctx, i: NewActivity): Promise<Result<{ id: string }>> {
  const summary = i.summary.trim();
  if (!summary) return err('VALIDATION', 'Summary is empty');
  if (summary.length > MAX_SUMMARY) return err('VALIDATION', 'Summary is too long');
  if (!DATE_RE.test(i.dueDate)) return err('VALIDATION', 'Due date must be YYYY-MM-DD');
  const typeId = await resolveActivityTypeId(ctx, i.typeKey, i.entity);
  if (!typeId.ok) return typeId;
  const assigneeId = i.assigneeId ?? ctx.userId;
  const [row] = await ctx.tx
    .insert(activities)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      entity: i.entity,
      recordId: i.recordId,
      activityTypeId: typeId.value,
      assigneeId,
      summary,
      dueDate: i.dueDate,
    })
    .returning({ id: activities.id });
  if (!row) return err('INTERNAL', 'insert failed');
  await audit(ctx, {
    entity: 'chatter.activity',
    recordId: row.id,
    action: 'create',
    after: { entity: i.entity, recordId: i.recordId, typeKey: i.typeKey, dueDate: i.dueDate, assigneeId },
  });
  return ok({ id: row.id });
}

export async function completeActivity(ctx: Ctx, id: string, feedback?: string): Promise<Result<{ id: string }>> {
  const [act] = await ctx.tx.select().from(activities).where(eq(activities.id, id)).limit(1);
  if (!act) return err('NOT_FOUND', 'Activity not found');
  if (act.doneAt) return err('STATE', 'Activity is already done');
  const note = feedback?.trim() || null;
  const doneAt = new Date();
  await ctx.tx
    .update(activities)
    .set({ doneAt, doneBy: ctx.userId, doneNote: note, updatedAt: doneAt })
    .where(eq(activities.id, id));
  await audit(ctx, {
    entity: 'chatter.activity',
    recordId: id,
    action: 'complete',
    before: { doneAt: null },
    after: { doneAt, doneNote: note },
  });
  return ok({ id });
}

/** Idempotent: does nothing if an open activity with the same entity, recordId, typeKey and dueDate exists. */
export async function ensureActivity(ctx: Ctx, i: NewActivity): Promise<Result<{ id: string; created: boolean }>> {
  const typeId = await resolveActivityTypeId(ctx, i.typeKey, i.entity);
  if (!typeId.ok) return typeId;
  const [existing] = await ctx.tx
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(
        eq(activities.entity, i.entity),
        eq(activities.recordId, i.recordId),
        eq(activities.activityTypeId, typeId.value),
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
  const msgs = await ctx.tx
    .select()
    .from(messages)
    .where(and(eq(messages.entity, entity), eq(messages.recordId, recordId)))
    .orderBy(desc(messages.createdAt))
    .limit(MAX_THREAD);
  const acts = await ctx.tx
    .select({ activity: activities, typeName: activityTypes.name })
    .from(activities)
    .innerJoin(activityTypes, eq(activities.activityTypeId, activityTypes.id))
    .where(and(eq(activities.entity, entity), eq(activities.recordId, recordId)))
    .orderBy(desc(activities.createdAt))
    .limit(MAX_THREAD);
  const items: ThreadItem[] = [
    ...msgs.map((m): ThreadItem => ({ kind: 'message', id: m.id, at: m.createdAt, message: m })),
    ...acts.map(
      (a): ThreadItem => ({ kind: 'activity', id: a.activity.id, at: a.activity.createdAt, activity: a.activity, typeName: a.typeName }),
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

/** Active members of the company, for the activity assignee select. */
export async function listAssignees(ctx: Ctx): Promise<{ id: string; name: string }[]> {
  const rows = await ctx.tx
    .select({ id: users.id, name: users.name })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(memberships.companyId, ctx.companyId), eq(memberships.status, 'active')))
    .orderBy(asc(users.name));
  return rows;
}
