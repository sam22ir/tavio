import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { createProject, changeProjectState, listStages } from '../service/projects';
import { createTask, listTasks, logTimesheet, moveTask } from '../service/tasks';

loadDevEnv();

const db = getDb();
const companyIds: string[] = [];

const PERMS = new Set([
  'projects.project.read',
  'projects.project.write',
  'projects.task.read',
  'projects.task.write',
  'projects.timesheet.read',
  'projects.timesheet.write',
]);

async function fixture(perms: ReadonlySet<string> = PERMS): Promise<TenantArgs> {
  const companyId = randomUUID();
  const userId = randomUUID();
  companyIds.push(companyId);
  await db.insert(companies).values({ id: companyId, legalName: 'Test SARL', displayName: 'Test' });
  await db.insert(users).values({ id: userId, name: 'projects test', email: `proj-${userId}@test.invalid` });
  return { userId, companyId, perms, locale: 'en' };
}

afterAll(async () => {
  if (companyIds.length > 0) await db.delete(companies).where(inArray(companies.id, companyIds));
});

describe.skipIf(!process.env.TAVIO_W5_DB)('projects services (db)', () => {
  it('creates a project with the three default stages', async () => {
    const args = await fixture();
    const id = await withTenant(args, async (ctx) => {
      const r = await createProject(ctx, { name: 'Website' });
      if (!r.ok) throw new Error(r.error.code);
      return r.value.id;
    });
    const stages = await withTenant(args, async (ctx) => {
      const r = await listStages(ctx, id);
      if (!r.ok) throw new Error(r.error.code);
      return r.value;
    });
    expect(stages.map((s) => s.name)).toEqual(['To do', 'In progress', 'Done']);
  });

  it('returns FORBIDDEN without the write permission', async () => {
    const args = await fixture(new Set(['projects.project.read']));
    const r = await withTenant(args, (ctx) => createProject(ctx, { name: 'Nope' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('FORBIDDEN');
  });

  it('rejects moving a task to a stage of another project', async () => {
    const args = await fixture();
    const { taskId, foreignStageId } = await withTenant(args, async (ctx) => {
      const a = await createProject(ctx, { name: 'A' });
      const b = await createProject(ctx, { name: 'B' });
      if (!a.ok || !b.ok) throw new Error('setup');
      const task = await createTask(ctx, { projectId: a.value.id, name: 'T', priority: 'normal' });
      if (!task.ok) throw new Error('setup task');
      const stagesB = await listStages(ctx, b.value.id);
      if (!stagesB.ok) throw new Error('setup stages');
      return { taskId: task.value.id, foreignStageId: stagesB.value[0]!.id };
    });
    const r = await withTenant(args, (ctx) => moveTask(ctx, taskId, foreignStageId));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_FOUND');
  });

  it('rejects zero hours and logs valid hours for the current user', async () => {
    const args = await fixture();
    const taskId = await withTenant(args, async (ctx) => {
      const p = await createProject(ctx, { name: 'Timed' });
      if (!p.ok) throw new Error('setup');
      const t = await createTask(ctx, { projectId: p.value.id, name: 'Task', priority: 'low' });
      if (!t.ok) throw new Error('setup task');
      return t.value.id;
    });
    const bad = await withTenant(args, (ctx) =>
      logTimesheet(ctx, { taskId, date: '2026-10-01', hours: '0', description: undefined }),
    );
    expect(bad.ok).toBe(false);
    const good = await withTenant(args, (ctx) =>
      logTimesheet(ctx, { taskId, date: '2026-10-01', hours: '1,5', description: 'Design' }),
    );
    expect(good.ok).toBe(true);
  });

  it('changes project state and refuses a same-state change', async () => {
    const args = await fixture();
    const id = await withTenant(args, async (ctx) => {
      const r = await createProject(ctx, { name: 'State' });
      if (!r.ok) throw new Error('setup');
      return r.value.id;
    });
    const first = await withTenant(args, (ctx) => changeProjectState(ctx, id, 'done'));
    expect(first.ok).toBe(true);
    const same = await withTenant(args, (ctx) => changeProjectState(ctx, id, 'done'));
    expect(same.ok).toBe(false);
  });

  it('lists tasks of a project', async () => {
    const args = await fixture();
    const tasks = await withTenant(args, async (ctx) => {
      const p = await createProject(ctx, { name: 'Listed' });
      if (!p.ok) throw new Error('setup');
      await createTask(ctx, { projectId: p.value.id, name: 'One', priority: 'high' });
      const r = await listTasks(ctx, p.value.id);
      if (!r.ok) throw new Error('list');
      return r.value;
    });
    expect(tasks).toHaveLength(1);
  });
});
