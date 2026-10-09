import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { TICKET_STAGES } from '@/modules/helpdesk/service/rules';
import { listTicketsForBoard } from '@/modules/helpdesk/service/tickets';
import { moveTicketStageAction } from '@/modules/helpdesk/actions';
import { ticketEntity } from '@/modules/helpdesk/entities';
import { buttonVariants } from '@/ui/primitives/button';
import { Kanban } from '@/ui/views/kanban';
import { cn } from '@/ui/lib/cn';

export default async function HelpdeskBoardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('helpdesk');
  const result = await withPageCtx((ctx) => listTicketsForBoard(ctx));

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t('ticket.title')}</h1>
        <nav aria-label={t('ticket.views')} className="flex flex-wrap gap-2">
          <Link href={`/${locale}/helpdesk/list`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
            {t('ticket.list')}
          </Link>
          <Link href={`/${locale}/helpdesk/teams`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
            {t('team.title')}
          </Link>
          <Link href={`/${locale}/helpdesk/new`} className={cn(buttonVariants({ size: 'sm' }))}>
            {t('ticket.new')}
          </Link>
        </nav>
      </header>

      {result.ok ? (
        <Kanban
          entity={ticketEntity}
          columns={TICKET_STAGES.map((s) => ({ id: s, label: t(`options.stage.${s}`) }))}
          rows={result.value}
          onMove={moveTicketStageAction}
          rowHref={(row) => `/${locale}/helpdesk/${row.id}`}
        />
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {t('ticket.error')}
        </p>
      )}
    </main>
  );
}
