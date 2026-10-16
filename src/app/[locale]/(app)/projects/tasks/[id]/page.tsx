import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { logTimeForm } from '@/modules/projects/actions';
import { timesheetEntity } from '@/modules/projects/entities';
import { getTask, listTimesheets } from '@/modules/projects/service/tasks';
import { Chatter } from '@/modules/chatter/ui/chatter';
import { RecordForm } from '@/ui/views/record-form';
import { formatCell } from '@/ui/views/format';
import { ok, type Result } from '@/core/result';
import type { Locale } from '@/core/ctx';
import type { ProjectTask, Timesheet } from '@/modules/projects/schema';

interface Detail {
  task: ProjectTask;
  timesheets: Timesheet[];
  totalHours: string;
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('projects');
  const currentLocale = await getLocale();
  const result = await withPageCtx(async (ctx): Promise<Result<Detail>> => {
    const task = await getTask(ctx, id);
    if (!task.ok) return task;
    const sheets = await listTimesheets(ctx, id);
    if (!sheets.ok) return sheets;
    return ok({ task: task.value, timesheets: sheets.value.rows, totalHours: sheets.value.totalHours });
  });

  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <div>
        <p role="alert" className="text-sm text-danger">{t('task.error')}</p>
      </div>
    );
  }
  const { task, timesheets, totalHours } = result.value;

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/${currentLocale}/projects/${task.projectId}`} className="text-sm text-muted hover:underline">
        ← {t('project.title')}
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight break-words">{task.name}</h1>
        <div className="flex flex-wrap gap-2 text-sm text-muted">
          <span>{t(`options.priority.${task.priority}`)}</span>
          {task.deadline ? <span>{t('task.due', { date: task.deadline })}</span> : null}
        </div>
        {task.description ? <p className="whitespace-pre-line text-sm">{task.description}</p> : null}
      </header>

      <section aria-labelledby="timesheets" className="flex flex-col gap-3">
        <h2 id="timesheets" className="text-base font-semibold">
          {t('task.timesheets')} <span className="text-muted">({t('task.totalHours', { hours: totalHours })})</span>
        </h2>
        {timesheets.length === 0 ? (
          <p className="text-sm text-muted">{t('task.noTimesheets')}</p>
        ) : (
          <section className="app-panel flex flex-col gap-4 p-5">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-start">
                    <tr>
                      <th className="p-2 text-start">{t('fields.date')}</th>
                      <th className="p-2 text-start">{t('fields.hours')}</th>
                      <th className="p-2 text-start">{t('fields.description')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timesheets.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="p-2">{formatCell(timesheetEntity.fields[0]!, row.date, currentLocale as Locale)}</td>
                        <td className="p-2">{row.hours}</td>
                        <td className="p-2">{row.description ?? '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </section>
        )}
        <div className="max-w-xl">
          <RecordForm
            entity={timesheetEntity}
            action={logTimeForm}
            hidden={{ taskId: id }}
            submitLabel={t('task.logTime')}
          />
        </div>
      </section>

      <section aria-labelledby="task-activity" className="flex flex-col gap-3">
        <h2 id="task-activity" className="text-base font-semibold">{t('task.activity')}</h2>
        <Chatter entity="projects.task" recordId={id} />
      </section>
    </div>
  );
}
