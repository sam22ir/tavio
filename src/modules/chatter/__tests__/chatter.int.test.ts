import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { activityTypes } from '../schema';
import { ACTIVITY_TYPE_SEED } from '../entities';
import {
  completeActivity,
  ensureActivity,
  listThread,
  myOpenActivities,
  postMessage,
  scheduleActivity,
} from '../service';

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
    ACTIVITY_TYPE_SEED.map((s) => ({ companyId, name: s.name, defaultDays: s.defaultDays, icon: s.icon })),
  );
});

afterAll(async () => {
  // Chatter rows are tenant data; the test rows are removed with their company where cascades allow.
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
    expect(open[0]!.typeName).toBe('Call');

    const done = await withTenant(a, (ctx) => completeActivity(ctx, open[0]!.id, 'reached client'), db);
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
});
