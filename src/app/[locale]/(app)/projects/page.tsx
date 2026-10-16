import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { parseListQuery } from '@/core/entities/list-query';
import { routing } from '@/i18n/routing';
import { projectEntity } from '@/modules/projects/entities';
import { listProjects } from '@/modules/projects/service/projects';
import { buttonVariants } from '@/ui/primitives/button';
import { DataList } from '@/ui/views/data-list';
import { cn } from '@/ui/lib/cn';

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, projectEntity);
  const result = await withPageCtx((ctx) => listProjects(ctx, query));
  const t = await getTranslations('projects');
  const currentLocale = await getLocale();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('project.title')}</h1>
      {result.ok ? (
        <DataList
          entity={projectEntity}
          result={result.value}
          query={query}
          basePath={`/${currentLocale}/projects`}
          rowHref={(row) => `/${currentLocale}/projects/${row.id}`}
          actions={
            <Link href={`/${currentLocale}/projects/new`} className={cn(buttonVariants())}>
              {t('project.new')}
            </Link>
          }
        />
      ) : (
        <p role="alert" className="text-sm text-danger">
          {t('project.error')}
        </p>
      )}
    </div>
  );
}
