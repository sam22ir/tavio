import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { parseListQuery } from '@/core/entities/list-query';
import { accountEntity } from '@/modules/accounting/entities';
import { listAccounts, ensureDefaults } from '@/modules/accounting/service/chart';
import { DataList } from '@/ui/views/data-list';

export default async function AccountsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, accountEntity);
  const result = await withPageCtx(async (ctx) => {
    await ensureDefaults(ctx);
    return listAccounts(ctx, query);
  });
  const t = await getTranslations('accounting');
  const currentLocale = await getLocale();

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('accounts.title')}</h1>
      <p role="note" className="text-sm text-muted-foreground">{t('accounts.verifyNote')}</p>
      <DataList
        entity={accountEntity}
        result={result}
        query={query}
        basePath={`/${currentLocale}/accounting/accounts`}
      />
    </main>
  );
}
