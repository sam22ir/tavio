import { and, asc, count, desc, eq, ilike, type SQL } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import type { ListQuery, ListResult } from '@/core/entities/types';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { projects, projectStages, type Project } from '../schema';
import { DEFAULT_STAGES, PROJECT_STATES, canChangeProjectState, type ProjectState } from './rules';
import { z } from 'zod';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PAGE_SIZE = 100;

export const projectInput = z.object({
  name: z.string().trim().min(1).max(200),
  partnerId: z.preprocess((v) => (typeof v === 'string' && v.trim() ? v : undefined), z.uuid().optional()),
});
export type ProjectInput = z.infer<typeof projectInput>;

export async function createProject(ctx: Ctx, input: ProjectInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'projects.project.write');
  if (!perm.ok) return perm;

  const [row] = await ctx.tx
    .insert(projects)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      name: input.name,
      partnerId: input.partnerId ?? null,
      managerId: ctx.userId,
      state: 'active',
    })
    .returning({ id: projects.id });
  if (!row) return err('INTERNAL', 'Insert failed');

  await ctx.tx.insert(projectStages).values(
    DEFAULT_STAGES.map((name, sequence) => ({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      projectId: row.id,
      name,
      sequence,
    })),
  );

  await audit(ctx, { action: 'create', entity: 'projects.project', recordId: row.id, after: { name: input.name } });
  return ok({ id: row.id });
}

export async function getProject(ctx: Ctx, id: string): Promise<Result<Project>> {
  const perm = requirePerm(ctx, 'projects.project.read');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(id)) return err('NOT_FOUND', 'Project not found');

  const [row] = await ctx.tx
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.companyId, ctx.companyId)))
    .limit(1);
  return row ? ok(row) : err('NOT_FOUND', 'Project not found');
}

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function listWhere(ctx: Ctx, query: ListQuery): SQL | undefined {
  const conditions: SQL[] = [eq(projects.companyId, ctx.companyId)];
  const term = query.q?.trim();
  if (term) conditions.push(ilike(projects.name, `%${escapeLike(term)}%`));
  const state = query.filters.state;
  if (state === 'active' || state === 'done' || state === 'archived') {
    conditions.push(eq(projects.state, state));
  }
  return and(...conditions);
}

export async function listProjects(ctx: Ctx, query: ListQuery): Promise<Result<ListResult<Project>>> {
  const perm = requirePerm(ctx, 'projects.project.read');
  if (!perm.ok) return perm;

  const where = listWhere(ctx, query);
  const pageSize = Math.min(Math.max(1, query.pageSize), MAX_PAGE_SIZE);
  const page = Math.max(1, query.page);
  const order = query.dir === 'desc' ? desc(projects.name) : asc(projects.name);

  const [totalRow] = await ctx.tx.select({ n: count() }).from(projects).where(where);
  const rows = await ctx.tx
    .select()
    .from(projects)
    .where(where)
    .orderBy(order, asc(projects.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return ok({ rows, total: Number(totalRow?.n ?? 0), page, pageSize });
}

export async function changeProjectState(ctx: Ctx, id: string, to: ProjectState): Promise<Result<void>> {
  const perm = requirePerm(ctx, 'projects.project.write');
  if (!perm.ok) return perm;
  if (!PROJECT_STATES.includes(to)) return err('VALIDATION', 'Invalid state');

  const [row] = await ctx.tx
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.companyId, ctx.companyId)))
    .for('update');
  if (!row) return err('NOT_FOUND', 'Project not found');
  if (!canChangeProjectState(row.state as ProjectState, to)) {
    return err('CONFLICT', 'Project is already in this state');
  }

  await ctx.tx
    .update(projects)
    .set({ state: to, updatedAt: new Date() })
    .where(eq(projects.id, id));
  await audit(ctx, {
    action: 'update',
    entity: 'projects.project',
    recordId: id,
    before: { state: row.state },
    after: { state: to },
  });
  return ok(undefined);
}

export async function listStages(ctx: Ctx, projectId: string): Promise<Result<{ id: string; name: string }[]>> {
  const perm = requirePerm(ctx, 'projects.task.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({ id: projectStages.id, name: projectStages.name })
    .from(projectStages)
    .where(and(eq(projectStages.companyId, ctx.companyId), eq(projectStages.projectId, projectId)))
    .orderBy(asc(projectStages.sequence), asc(projectStages.id));
  return ok(rows);
}
