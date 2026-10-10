import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { parseListQuery } from '@/core/entities/list-query';
import { entryEntity } from '@/modules/accounting/entities';
import { listEntries } from '@/modules/accounting/service/entries';
import { ensureDefaults } from '@/modules/accounting/service/chart';
import { buttonVariants } from '@/ui/primitives/button';
import { DataList } from '@/ui/views/data-list';
import { cn } from '@/ui/lib/cn';

export default async function EntriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, entryEntity);
  const result = await withPageCtx(async (ctx) => {
    await ensureDefaults(ctx);
    return listEntries(ctx, query);
  });
  const t = await getTranslations('accounting');
  const ioT = await getTranslations('io.import');
  const currentLocale = await getLocale();

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('entries.title')}</h1>
      <DataList
        entity={entryEntity}
        result={result}
        query={query}
        basePath={`/${currentLocale}/accounting/entries`}
        rowHref={(row) => `/${currentLocale}/accounting/entries/${row.id}`}
        actions={
          <>
            <Link href={`/${currentLocale}/import/accounting.opening_balance`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
              {ioT('button')}
            </Link>
            <Link href={`/${currentLocale}/accounting/entries/new`} className={cn(buttonVariants())}>
              {t('entries.new')}
            </Link>
          </>
        }
      />
    </main>
  );
}
