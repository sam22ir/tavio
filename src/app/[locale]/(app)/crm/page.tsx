import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { buttonVariants } from '@/ui/primitives/button';
import { cn } from '@/ui/lib/cn';
import * as crm from '@/modules/crm/service';
import { moveLeadAction } from '@/modules/crm/actions';
import { KanbanBoard } from '@/modules/crm/ui/kanban-board';

export default async function CrmPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const sp = await searchParams;
  const teamId = typeof sp.teamId === 'string' && sp.teamId ? sp.teamId : undefined;
  const t = await getTranslations('crm.ui');
  const requested = typeof sp.pipeline === 'string' ? sp.pipeline : undefined;
  const board = await withPageCtx(async (ctx) => {
    const pipelines = await crm.listPipelines(ctx);
    if (!pipelines.ok) return { error: pipelines.error.message };
    // The requested pipeline must belong to the company; otherwise fall back to the default.
    const selected =
      pipelines.value.find((p) => p.id === requested) ??
      (await crm.ensureDefaultPipeline(ctx).then((p) => (p.ok ? pipelines.value.find((x) => x.id === p.value.id) : undefined)));
    if (!selected) return { error: 'loadError' };
    const stages = await crm.listStages(ctx, selected.id);
    if (!stages.ok) return { error: stages.error.message };
    const groups = await crm.leadsByStage(ctx, selected.id, { teamId });
    if (!groups.ok) return { error: groups.error.message };
    const teams = await crm.listTeams(ctx);
    return {
      pipelineId: selected.id,
      pipelines: pipelines.value,
      columns: stages.value.map((s) => ({ id: s.id, label: s.name })),
      rows: groups.value.flatMap((g) => g.leads),
      teams: teams.ok ? teams.value : [],
    };
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <nav aria-label={t('viewToggle')} className="flex gap-1">
            <Link href={`/${locale}/crm`} aria-current="page" className={cn(buttonVariants({ size: 'sm' }))}>
              {t('kanban')}
            </Link>
            <Link href={`/${locale}/crm/list`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
              {t('list')}
            </Link>
          </nav>
          <Link
            href={`/${locale}/crm/new${'error' in board ? '' : `?pipeline=${board.pipelineId}`}`}
            className={cn(buttonVariants({ size: 'sm' }))}
          >
            {t('newLead')}
          </Link>
        </div>
      </div>

      {'error' in board ? null : (
        <form method="get" className="flex items-center gap-2 text-sm">
          <label htmlFor="pipeline-filter">{t('pipelineFilter')}</label>
          <select id="pipeline-filter" name="pipeline" defaultValue={board.pipelineId} className="h-9 rounded-md border bg-background px-3">
            {board.pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <label htmlFor="team-filter">{t('teamFilter')}</label>
          <select id="team-filter" name="teamId" defaultValue={teamId ?? ''} className="h-9 rounded-md border bg-background px-3">
            <option value="">{t('allTeams')}</option>
            {board.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <button type="submit" className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
            {t('applyFilter')}
          </button>
          <Link href={`/${locale}/crm/teams`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
            {t('teams')}
          </Link>
        </form>
      )}

      {'error' in board ? (
        <p role="alert" className="rounded-md border p-4 text-sm text-destructive">
          {t('loadError')}
        </p>
      ) : (
        <KanbanBoard
          columns={board.columns}
          rows={board.rows}
          basePath={`/${locale}/crm`}
          move={moveLeadAction}
        />
      )}
    </section>
  );
}
