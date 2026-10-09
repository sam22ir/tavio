import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { parseListQuery } from '@/core/entities/list-query';
import { buttonVariants } from '@/ui/primitives/button';
import { DataList } from '@/ui/views/data-list';
import { cn } from '@/ui/lib/cn';
import * as crm from '@/modules/crm/service';
import { leadEntity } from '@/modules/crm/entities';

export default async function CrmListPage({
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
  const query = parseListQuery(sp, leadEntity);
  const teamParam = typeof sp.teamId === 'string' ? sp.teamId : '';
  if (teamParam) query.filters = { ...query.filters, teamId: teamParam };
  const t = await getTranslations('crm.ui');
  const data = await withPageCtx(async (ctx) => {
    const [result, teams] = await Promise.all([crm.listLeads(ctx, query), crm.listTeams(ctx)]);
    return { result, teams: teams.ok ? teams.value : [] };
  });
  const result = data.result;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <nav aria-label={t('viewToggle')} className="flex gap-1">
          <Link href={`/${locale}/crm`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
            {t('kanban')}
          </Link>
          <Link href={`/${locale}/crm/list`} aria-current="page" className={cn(buttonVariants({ size: 'sm' }))}>
            {t('list')}
          </Link>
          <Link href={`/${locale}/crm/new`} className={cn(buttonVariants({ size: 'sm' }))}>
            {t('newLead')}
          </Link>
          <Link href={`/${locale}/crm/teams`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
            {t('teams')}
          </Link>
        </nav>
      </div>

      <form method="get" className="flex items-center gap-2 text-sm">
        <label htmlFor="team-filter">{t('teamFilter')}</label>
        <select id="team-filter" name="teamId" defaultValue={teamParam} className="h-9 rounded-md border bg-background px-3">
          <option value="">{t('allTeams')}</option>
          {data.teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        <button type="submit" className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
          {t('applyFilter')}
        </button>
      </form>

      {result.ok ? (
        <DataList
          entity={leadEntity}
          result={result.value}
          query={query}
          basePath={`/${locale}/crm/list`}
          rowHref={(r) => `/${locale}/crm/${r.id}`}
        />
      ) : (
        <p role="alert" className="rounded-md border p-4 text-sm text-destructive">
          {t('loadError')}
        </p>
      )}
    </section>
  );
}
