import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { changeProjectStateForm, createTaskForm, moveTaskStage } from '@/modules/projects/actions';
import { getProject, listStages } from '@/modules/projects/service/projects';
import { listTasks } from '@/modules/projects/service/tasks';
import { taskEntity } from '@/modules/projects/entities';
import type { Project, ProjectTask } from '@/modules/projects/schema';
import { ok, type Result } from '@/core/result';
import { Chatter } from '@/modules/chatter/ui/chatter';
import { Button } from '@/ui/primitives/button';
import { LinkedKanban } from '@/ui/views/linked-kanban';
import { RecordForm } from '@/ui/views/record-form';
import { RelatedLinks } from '@/ui/views/related-links';

interface Board {
  project: Project;
  stages: { id: string; name: string }[];
  tasks: ProjectTask[];
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('projects');
  const currentLocale = await getLocale();
  const board = await withPageCtx(async (ctx): Promise<Result<Board>> => {
    const project = await getProject(ctx, id);
    if (!project.ok) return project;
    const stages = await listStages(ctx, id);
    if (!stages.ok) return stages;
    const tasks = await listTasks(ctx, id);
    if (!tasks.ok) return tasks;
    return ok({ project: project.value, stages: stages.value, tasks: tasks.value });
  });

  if (!board.ok) {
    if (board.error.code === 'NOT_FOUND') notFound();
    return (
      <main className="p-4 md:p-6">
        <p role="alert" className="text-sm text-destructive">{t('project.error')}</p>
      </main>
    );
  }
  const { project, stages, tasks } = board.value;
  const nextState = project.state === 'active' ? 'done' : 'active';

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <Link href={`/${currentLocale}/projects`} className="text-sm text-muted-foreground hover:underline">
        ← {t('project.title')}
      </Link>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold break-words">{project.name}</h1>
          <span className="text-sm text-muted-foreground">{t(`options.state.${project.state}`)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(['active', 'done', 'archived'] as const)
            .filter((s) => s !== project.state)
            .map((s) => (
              <form key={s} action={changeProjectStateForm}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="state" value={s} />
                <Button type="submit" variant={s === nextState ? 'default' : 'outline'} className="min-h-11">
                  {t(`project.set.${s}`)}
                </Button>
              </form>
            ))}
        </div>
      </header>
      <RelatedLinks source="projects.project" id={id} />

      <section aria-labelledby="project-tasks" className="flex flex-col gap-3">
        <h2 id="project-tasks" className="text-base font-semibold">{t('project.tasks')}</h2>
        <LinkedKanban
          entity={taskEntity}
          columns={stages.map((s) => ({ id: s.id, label: s.name }))}
          rows={tasks.map((task) => ({ ...task, id: task.id }))}
          onMove={moveTaskStage}
          basePath={`/${currentLocale}/projects/tasks`}
        />
      </section>

      <section aria-labelledby="new-task" className="flex max-w-2xl flex-col gap-3">
        <h2 id="new-task" className="text-base font-semibold">{t('project.newTask')}</h2>
        <RecordForm
          entity={taskEntity}
          action={createTaskForm}
          hidden={{ projectId: id }}
          submitLabel={t('project.newTask')}
        />
      </section>

      <section aria-labelledby="project-activity" className="flex flex-col gap-3">
        <h2 id="project-activity" className="text-base font-semibold">{t('project.activity')}</h2>
        <Chatter entity="projects.project" recordId={id} />
      </section>
    </main>
  );
}
