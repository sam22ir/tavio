import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { parseListQuery } from '@/core/entities/list-query';
import { accountEntity } from '@/modules/accounting/entities';
import { listAccounts, ensureDefaults } from '@/modules/accounting/service/chart';
import { AccountForm } from '@/modules/accounting/ui/account-form';
import { DataList } from '@/ui/views/data-list';
import { buttonVariants } from '@/ui/primitives/button';
import { cn } from '@/ui/lib/cn';

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
  const ioT = await getTranslations('io.import');
  const currentLocale = await getLocale();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('accounts.title')}</h1>
      <p role="note" className="text-sm text-muted">{t('accounts.verifyNote')}</p>
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t('accounts.new')}</h2>
        <AccountForm locale={currentLocale} />
      </section>
      <DataList
        entity={accountEntity}
        result={result}
        query={query}
        basePath={`/${currentLocale}/accounting/accounts`}
        actions={
          <Link href={`/${currentLocale}/import/accounting.chart_account`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
            {ioT('button')}
          </Link>
        }
      />
    </div>
  );
}
