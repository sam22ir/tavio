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

export default async function CrmPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('crm.ui');
  const board = await withPageCtx(async (ctx) => {
    const pipeline = await crm.ensureDefaultPipeline(ctx);
    if (!pipeline.ok) return { error: pipeline.error.message as string };
    const stages = pipeline.value.stages as { id: string; name: string }[];
    const rows = await crm.leadsByStage(ctx, pipeline.value.pipelineId as string);
    if (!rows.ok) return { error: rows.error.message as string };
    return {
      columns: stages.map((s) => ({ id: s.id, label: s.name })),
      rows: rows.value,
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
          <Link href={`/${locale}/crm/new`} className={cn(buttonVariants({ size: 'sm' }))}>
            {t('newLead')}
          </Link>
        </div>
      </div>

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
