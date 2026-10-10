import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, memberships, roles, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { activities, activityTypes } from '../schema';
import { ACTIVITY_TYPE_SEED } from '../entities';
import {
  completeActivity,
  ensureActivity,
  listPlans,
  listThread,
  myOpenActivities,
  postMessage,
  savePlan,
  scheduleActivity,
} from '../service';
import { cancelPlanRuns, launchPlan } from '../service/plans';

loadDevEnv();

const db = getDb();
const userId = randomUUID();
const companyId = randomUUID();
const otherCompanyId = randomUUID();
const entity = 'contacts.partner';
const recordId = randomUUID();
const args = (cid: string): TenantArgs => ({ userId, companyId: cid, perms: new Set<string>(), locale: 'en' });

beforeAll(async () => {
  await db.insert(users).values({ id: userId, name: 'chatter test', email: `chatter-${userId}@test.invalid` });
  await db.insert(companies).values([
    { id: companyId, legalName: 'Chatter A', displayName: 'Chatter A' },
    { id: otherCompanyId, legalName: 'Chatter B', displayName: 'Chatter B' },
  ]);
  await db.insert(activityTypes).values(
    ACTIVITY_TYPE_SEED.map((s) => ({ companyId, name: s.key, defaultDays: s.defaultDays, icon: s.icon })),
  );
  // Plan launches require the owner to be an active member of the company (assertMembers).
  const [ownerRole] = await db
    .insert(roles)
    .values({ companyId, key: 'owner', name: 'Owner', isSystem: true })
    .returning({ id: roles.id });
  await db.insert(memberships).values({
    companyId,
    userId,
    roleId: ownerRole!.id,
    status: 'active',
    joinedAt: new Date(),
    createdBy: userId,
  });
});

afterAll(async () => {
  // Chatter rows are tenant data; the test rows are removed with their company where cascades allow.
  await db.delete(memberships).where(inArray(memberships.companyId, [companyId, otherCompanyId])).catch(() => undefined);
  await db.delete(roles).where(inArray(roles.companyId, [companyId, otherCompanyId])).catch(() => undefined);
  await db.delete(companies).where(inArray(companies.id, [companyId, otherCompanyId])).catch(() => undefined);
  await db.delete(users).where(eq(users.id, userId)).catch(() => undefined);
});

describe('chatter service', () => {
  it('posts messages and returns the thread newest first', async () => {
    const a = args(companyId);
    const rid = randomUUID();
    const first = await withTenant(a, (ctx) => postMessage(ctx, { entity, recordId: rid, body: 'first' }), db);
    expect(first.ok).toBe(true);
    await withTenant(a, (ctx) => postMessage(ctx, { entity, recordId: rid, body: 'note', kind: 'note' }), db);
    await withTenant(a, (ctx) => postMessage(ctx, { entity, recordId: rid, body: 'Contract activated', kind: 'system' }), db);
    const thread = await withTenant(a, (ctx) => listThread(ctx, entity, rid), db);
    expect(thread.length).toBe(3);
    expect(thread[0]!.kind === 'message' && thread[0]!.message.type).toBe('system');
    expect(thread[2]!.kind === 'message' && thread[2]!.message.body).toBe('first');
  });

  it('schedules an activity, ensures idempotently, completes it and lists it as mine', async () => {
    const a = args(companyId);
    const rid = randomUUID();
    const item = { entity, recordId: rid, typeKey: 'call', summary: 'Call about payment', dueDate: '2026-10-10' };
    const scheduled = await withTenant(a, (ctx) => scheduleActivity(ctx, item), db);
    expect(scheduled.ok).toBe(true);

    // The activity already exists, so ensure must not create a second one.
    const e1 = await withTenant(a, (ctx) => ensureActivity(ctx, item), db);
    expect(e1.ok && e1.value.created).toBe(false);
    expect(e1.ok && e1.value.id).toBe(scheduled.ok ? scheduled.value.id : '');

    const mine = await withTenant(a, (ctx) => myOpenActivities(ctx, 50), db);
    const open = mine.filter((m) => m.recordId === rid);
    expect(open.length).toBe(1);
    expect(open[0]!.typeName).toBe('call');

    const done = await withTenant(a, (ctx) => completeActivity(ctx, open[0]!.id, { result: 'reached client' }), db);
    expect(done.ok).toBe(true);
    const again = await withTenant(a, (ctx) => completeActivity(ctx, open[0]!.id), db);
    expect(again.ok).toBe(false);
    const afterDone = await withTenant(a, (ctx) => myOpenActivities(ctx, 50), db);
    expect(afterDone.filter((m) => m.recordId === rid).length).toBe(0);
  });

  it('validates input and does not leak threads across companies', async () => {
    const a = args(companyId);
    const bad = await withTenant(a, (ctx) => postMessage(ctx, { entity, recordId, body: '   ' }), db);
    expect(bad.ok).toBe(false);
    const badDate = await withTenant(
      a,
      (ctx) => scheduleActivity(ctx, { entity, recordId, typeKey: 'todo', summary: 'x', dueDate: '10/10/2026' }),
      db,
    );
    expect(badDate.ok).toBe(false);

    const b = args(otherCompanyId);
    const otherThread = await withTenant(b, (ctx) => listThread(ctx, entity, recordId), db);
    expect(otherThread.length).toBe(0);
  });

  it('requires a result when the activity type says so', async () => {
    const a = args(companyId);
    const rid = randomUUID();
    const typeId = await withTenant(a, async (ctx) => {
      const [row] = await ctx.tx.select().from(activityTypes).where(eq(activityTypes.name, 'meeting'));
      return row!.id;
    }, db);
    await db.update(activityTypes).set({ requireResult: true }).where(eq(activityTypes.id, typeId));
    const sched = await withTenant(a, (ctx) => scheduleActivity(ctx, { entity, recordId: rid, activityTypeId: typeId, summary: 'Meet', dueDate: '2026-10-10' }), db);
    expect(sched.ok).toBe(true);
    const id = sched.ok ? sched.value.id : '';
    const missing = await withTenant(a, (ctx) => completeActivity(ctx, id, {}), db);
    expect(missing.ok).toBe(false);
    const done = await withTenant(a, (ctx) => completeActivity(ctx, id, { result: 'signed' }), db);
    expect(done.ok).toBe(true);
    await db.update(activityTypes).set({ requireResult: false }).where(eq(activityTypes.id, typeId));
  });

  it('launches a plan, replaces earlier runs, and keeps plans tenant-scoped', async () => {
    const a = args(companyId);
    const rid = randomUUID();
    const todoId = await withTenant(a, async (ctx) => {
      const [row] = await ctx.tx.select().from(activityTypes).where(eq(activityTypes.name, 'todo'));
      return row!.id;
    }, db);
    const plan = await withTenant(a, (ctx) => savePlan(ctx, {
      name: 'Follow-up',
      entity,
      active: true,
      steps: [
        { activityTypeId: todoId, summary: 'Day 1 call', offsetDays: 1, responsible: 'record_owner', userId: null },
        { activityTypeId: todoId, summary: 'Day 3 call', offsetDays: 3, responsible: 'record_owner', userId: null },
      ],
    }), db);
    expect(plan.ok).toBe(true);
    const planId = plan.ok ? plan.value.id : '';

    const run1 = await withTenant(a, (ctx) => launchPlan(ctx, planId, entity, rid, '2026-10-10', userId), db);
    expect(run1.ok).toBe(true);
    const run2 = await withTenant(a, (ctx) => launchPlan(ctx, planId, entity, rid, '2026-10-20', userId), db);
    expect(run2.ok).toBe(true);
    const runId2 = run2.ok ? run2.value.runId : '';
    const cancelled = await withTenant(a, (ctx) => cancelPlanRuns(ctx, entity, rid, { exceptRunId: runId2 }), db);
    expect(cancelled).toEqual({ ok: true, value: { cancelledRuns: 1, deletedActivities: 2 } });

    const open = await db.select().from(activities).where(eq(activities.recordId, rid));
    expect(open.length).toBe(2);
    expect(open.every((x) => x.planRunId === runId2)).toBe(true);

    const otherPlans = await withTenant(args(otherCompanyId), (ctx) => listPlans(ctx), db);
    expect(otherPlans.length).toBe(0);
    const foreign = await withTenant(args(otherCompanyId), (ctx) => launchPlan(ctx, planId, entity, rid, '2026-10-10', userId), db);
    expect(foreign.ok).toBe(false);
  });
});
