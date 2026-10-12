import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { withPageCtx } from '@/core/actions/page-ctx';
import { parseListQuery } from '@/core/entities/list-query';
import { routing } from '@/i18n/routing';
import { campaignEntity } from '@/modules/marketing/entities';
import { listCampaigns } from '@/modules/marketing/service/campaigns';
import { notFound } from 'next/navigation';
import { buttonVariants } from '@/ui/primitives/button';
import { DataList } from '@/ui/views/data-list';
import { cn } from '@/ui/lib/cn';

export default async function MarketingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, campaignEntity);
  const result = await withPageCtx((ctx) => listCampaigns(ctx, query));
  const t = await getTranslations('marketing');
  const currentLocale = await getLocale();

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('page.title')}</h1>
      {result.ok ? (
        <DataList
          entity={campaignEntity}
          result={result.value}
          query={query}
          basePath={`/${currentLocale}/marketing`}
          rowHref={(row) => `/${currentLocale}/marketing/${row.id}`}
          actions={
            <Link href={`/${currentLocale}/marketing/new`} className={cn(buttonVariants())}>
              {t('page.new')}
            </Link>
          }
        />
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {t('page.error')}
        </p>
      )}
    </div>
  );
}
