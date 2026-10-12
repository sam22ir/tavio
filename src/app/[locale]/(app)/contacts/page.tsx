import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { withPageCtx } from '@/core/actions/page-ctx';
import { parseListQuery } from '@/core/entities/list-query';
import { routing } from '@/i18n/routing';
import { partnerEntity } from '@/modules/contacts/entities';
import { listPartners } from '@/modules/contacts/service/partners';
import { buttonVariants } from '@/ui/primitives/button';
import { DataList } from '@/ui/views/data-list';
import { cn } from '@/ui/lib/cn';

export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, partnerEntity);
  const result = await withPageCtx((ctx) => listPartners(ctx, query));
  const t = await getTranslations('contacts');
  const currentLocale = await getLocale();
  const ioT = await getTranslations('io.import');

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('partner.title')}</h1>
      {result.ok ? (
        <DataList
          entity={partnerEntity}
          result={result.value}
          query={query}
          basePath={`/${currentLocale}/contacts`}
          rowHref={(row) => `/${currentLocale}/contacts/${row.id}`}
          actions={
            <>
              <Link href={`/${currentLocale}/import/contacts.partner`} className={cn(buttonVariants({ variant: 'outline' }))}>
                {ioT('button')}
              </Link>
              <Link href={`/${currentLocale}/contacts/new`} className={cn(buttonVariants())}>
                {t('partner.new')}
              </Link>
            </>
          }
        />
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {t('partner.error')}
        </p>
      )}
    </div>
  );
}
