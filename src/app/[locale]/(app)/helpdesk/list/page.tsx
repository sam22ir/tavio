import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { parseListQuery } from '@/core/entities/list-query';
import { routing } from '@/i18n/routing';
import { ticketEntity } from '@/modules/helpdesk/entities';
import { listTickets } from '@/modules/helpdesk/service/tickets';
import { buttonVariants } from '@/ui/primitives/button';
import { DataList } from '@/ui/views/data-list';
import { cn } from '@/ui/lib/cn';

export default async function TicketListPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, ticketEntity);
  const result = await withPageCtx((ctx) => listTickets(ctx, query));
  const t = await getTranslations('helpdesk');
  const currentLocale = await getLocale();

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('ticket.list')}</h1>
      {result.ok ? (
        <DataList
          entity={ticketEntity}
          result={result.value}
          query={query}
          basePath={`/${currentLocale}/helpdesk/list`}
          rowHref={(row) => `/${currentLocale}/helpdesk/${row.id}`}
          actions={
            <Link href={`/${currentLocale}/helpdesk`} className={cn(buttonVariants({ variant: 'outline' }))}>
              {t('ticket.board')}
            </Link>
          }
        />
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {t('ticket.error')}
        </p>
      )}
    </main>
  );
}
