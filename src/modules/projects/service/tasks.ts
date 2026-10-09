import { and, asc, eq, sum } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { projectStages, projectTasks, timesheets, type ProjectTask, type Timesheet } from '../schema';
import { parseHours, TASK_PRIORITIES } from './rules';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const optionalUuid = z.preprocess((v) => (typeof v === 'string' && v.trim() ? v : undefined), z.uuid().optional());
const optionalText = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() || undefined : v),
  z.string().max(5000).optional(),
);

export const taskInput = z.object({
  projectId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  stageId: optionalUuid,
  priority: z.enum(TASK_PRIORITIES).default('normal'),
  deadline: z.preprocess((v) => (typeof v === 'string' && v.trim() ? v : undefined), z.iso.date().optional()),
  description: optionalText,
});
export type TaskInput = z.infer<typeof taskInput>;

export const timesheetInput = z.object({
  taskId: z.uuid(),
  date: z.iso.date(),
  hours: z.string(),
  description: optionalText,
});
export type TimesheetInput = z.infer<typeof timesheetInput>;

export async function createTask(ctx: Ctx, input: TaskInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'projects.task.write');
  if (!perm.ok) return perm;

  // The stage must belong to the same project. Default to the first stage when none is given.
  const stages = await ctx.tx
    .select({ id: projectStages.id })
    .from(projectStages)
    .where(and(eq(projectStages.companyId, ctx.companyId), eq(projectStages.projectId, input.projectId)))
    .orderBy(asc(projectStages.sequence), asc(projectStages.id));
  const stageId = input.stageId ?? stages[0]?.id;
  if (!stageId || !stages.some((s) => s.id === stageId)) {
    return err('NOT_FOUND', 'Stage not found in this project');
  }

  const [row] = await ctx.tx
    .insert(projectTasks)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      projectId: input.projectId,
      stageId,
      name: input.name,
      priority: input.priority,
      deadline: input.deadline ?? null,
      description: input.description ?? null,
      assigneeId: null,
    })
    .returning({ id: projectTasks.id });
  if (!row) return err('INTERNAL', 'Insert failed');

  await audit(ctx, { action: 'create', entity: 'projects.task', recordId: row.id, after: { name: input.name } });
  return ok({ id: row.id });
}

export async function listTasks(ctx: Ctx, projectId: string): Promise<Result<ProjectTask[]>> {
  const perm = requirePerm(ctx, 'projects.task.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select()
    .from(projectTasks)
    .where(and(eq(projectTasks.companyId, ctx.companyId), eq(projectTasks.projectId, projectId)))
    .orderBy(asc(projectTasks.createdAt), asc(projectTasks.id));
  return ok(rows);
}

export async function getTask(ctx: Ctx, id: string): Promise<Result<ProjectTask>> {
  const perm = requirePerm(ctx, 'projects.task.read');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(id)) return err('NOT_FOUND', 'Task not found');
  const [row] = await ctx.tx
    .select()
    .from(projectTasks)
    .where(and(eq(projectTasks.id, id), eq(projectTasks.companyId, ctx.companyId)))
    .limit(1);
  return row ? ok(row) : err('NOT_FOUND', 'Task not found');
}

/** Moves a task to another stage of its own project (Kanban drag and drop). */
export async function moveTask(ctx: Ctx, taskId: string, stageId: string): Promise<Result<void>> {
  const perm = requirePerm(ctx, 'projects.task.write');
  if (!perm.ok) return perm;

  const [task] = await ctx.tx
    .select()
    .from(projectTasks)
    .where(and(eq(projectTasks.id, taskId), eq(projectTasks.companyId, ctx.companyId)))
    .for('update');
  if (!task) return err('NOT_FOUND', 'Task not found');

  const [stage] = await ctx.tx
    .select({ id: projectStages.id })
    .from(projectStages)
    .where(
      and(
        eq(projectStages.id, stageId),
        eq(projectStages.companyId, ctx.companyId),
        eq(projectStages.projectId, task.projectId),
      ),
    )
    .limit(1);
  if (!stage) return err('NOT_FOUND', 'Stage not found in this project');
  if (task.stageId === stageId) return ok(undefined);

  await ctx.tx
    .update(projectTasks)
    .set({ stageId, updatedAt: new Date() })
    .where(eq(projectTasks.id, taskId));
  await audit(ctx, {
    action: 'update',
    entity: 'projects.task',
    recordId: taskId,
    before: { stageId: task.stageId },
    after: { stageId },
  });
  return ok(undefined);
}

/** Logs time against a task for the current user. Hours are validated by parseHours. */
export async function logTimesheet(ctx: Ctx, input: TimesheetInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'projects.timesheet.write');
  if (!perm.ok) return perm;

  const hours = parseHours(input.hours);
  if (!hours.ok) return hours;

  const [task] = await ctx.tx
    .select({ id: projectTasks.id })
    .from(projectTasks)
    .where(and(eq(projectTasks.id, input.taskId), eq(projectTasks.companyId, ctx.companyId)))
    .limit(1);
  if (!task) return err('NOT_FOUND', 'Task not found');

  const [row] = await ctx.tx
    .insert(timesheets)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      taskId: input.taskId,
      userId: ctx.userId,
      date: input.date,
      hours: hours.value,
      description: input.description ?? null,
    })
    .returning({ id: timesheets.id });
  if (!row) return err('INTERNAL', 'Insert failed');

  await audit(ctx, { action: 'create', entity: 'projects.timesheet', recordId: row.id, after: { taskId: input.taskId, hours: hours.value } });
  return ok({ id: row.id });
}

export async function listTimesheets(ctx: Ctx, taskId: string): Promise<Result<{ rows: Timesheet[]; totalHours: string }>> {
  const perm = requirePerm(ctx, 'projects.timesheet.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select()
    .from(timesheets)
    .where(and(eq(timesheets.companyId, ctx.companyId), eq(timesheets.taskId, taskId)))
    .orderBy(asc(timesheets.date), asc(timesheets.id));
  const [totals] = await ctx.tx
    .select({ total: sum(timesheets.hours) })
    .from(timesheets)
    .where(and(eq(timesheets.companyId, ctx.companyId), eq(timesheets.taskId, taskId)));
  return ok({ rows, totalHours: Number(totals?.total ?? 0).toFixed(2) });
}
