import Link from 'next/link';
import { stageLabel } from '@/modules/crm/stage-names';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { KanbanSquare, List, Plus, Users } from 'lucide-react';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { buttonVariants } from '@/ui/primitives/button';
import { cn } from '@/ui/lib/cn';
import * as crm from '@/modules/crm/service';
import { moveLeadAction } from '@/modules/crm/actions';
import { KanbanBoard } from '@/modules/crm/ui/kanban-board';

const FILTER = 'h-10 rounded-full border border-separator bg-surface px-3 text-sm text-foreground';

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
      columns: stages.value.map((s) => ({ id: s.id, label: stageLabel(s.name, locale) })),
      rows: groups.value.flatMap((g) => g.leads),
      teams: teams.ok ? teams.value : [],
    };
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <nav aria-label={t('viewToggle')} className="flex h-11 items-center gap-1 rounded-full bg-surface p-1 shadow-[0_1px_2px_rgb(20_23_28/0.04)]">
            <Link href={`/${locale}/crm`} aria-current="page" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-accent-foreground">
              <KanbanSquare aria-hidden="true" className="size-4" />
              {t('kanban')}
            </Link>
            <Link href={`/${locale}/crm/list`} className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm text-muted transition-colors hover:bg-default hover:text-foreground">
              <List aria-hidden="true" className="size-4" />
              {t('list')}
            </Link>
          </nav>
          <Link
            href={`/${locale}/crm/new${'error' in board ? '' : `?pipeline=${board.pipelineId}`}`}
            className={cn(buttonVariants({ size: 'sm' }), 'h-11 rounded-full px-4')}
          >
            <Plus aria-hidden="true" className="size-4" />
            {t('newLead')}
          </Link>
        </div>
      </div>

      {'error' in board ? null : (
        <form method="get" className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <label htmlFor="pipeline-filter" className="flex items-center gap-2 text-muted">
            {t('pipelineFilter')}
            <select id="pipeline-filter" name="pipeline" defaultValue={board.pipelineId} className={FILTER}>
              {board.pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="team-filter" className="flex items-center gap-2 text-muted">
            {t('teamFilter')}
            <select id="team-filter" name="teamId" defaultValue={teamId ?? ''} className={FILTER}>
              <option value="">{t('allTeams')}</option>
              {board.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={cn(buttonVariants({ size: 'sm' }), 'h-10 rounded-full px-4')}>
            {t('applyFilter')}
          </button>
          <Link href={`/${locale}/crm/teams`} className="ms-auto inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-muted transition-colors hover:bg-default hover:text-foreground">
            <Users aria-hidden="true" className="size-4" />
            {t('teams')}
          </Link>
        </form>
      )}

      {'error' in board ? (
        <p role="alert" className="rounded-2xl bg-tint-danger p-4 text-sm text-tint-danger-fg">
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
