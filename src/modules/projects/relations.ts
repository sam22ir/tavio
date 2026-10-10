// Smart buttons on a project detail page. Side-effect file: imported by modules/relation-handlers.
import { and, count, eq, inArray } from 'drizzle-orm';
import { relations } from '@/core/relations';
import { projectTasks, timesheets } from '@/modules/projects/schema';

relations.register({
  id: 'projects.project->projects.task',
  source: 'projects.project',
  labelKey: 'relations.project.tasks',
  icon: 'ListChecks',
  perm: 'projects.task.read',
  count: async (ctx, id) => {
    const [row] = await ctx.tx
      .select({ value: count() })
      .from(projectTasks)
      .where(and(eq(projectTasks.companyId, ctx.companyId), eq(projectTasks.projectId, id)));
    return row?.value ?? 0;
  },
  href: (locale, id) => `/${locale}/projects/${id}`,
});

relations.register({
  id: 'projects.project->projects.timesheet',
  source: 'projects.project',
  labelKey: 'relations.project.timesheets',
  icon: 'Clock',
  perm: 'projects.timesheet.read',
  count: async (ctx, id) => {
    const tasks = ctx.tx
      .select({ id: projectTasks.id })
      .from(projectTasks)
      .where(and(eq(projectTasks.companyId, ctx.companyId), eq(projectTasks.projectId, id)));
    const [row] = await ctx.tx
      .select({ value: count() })
      .from(timesheets)
      .where(and(eq(timesheets.companyId, ctx.companyId), inArray(timesheets.taskId, tasks)));
    return row?.value ?? 0;
  },
  href: (locale, id) => `/${locale}/projects/${id}`,
});
