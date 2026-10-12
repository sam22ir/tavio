import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { moveTicketStageForm } from '@/modules/helpdesk/actions';
import { TICKET_STAGES, canTransition, type TicketStage } from '@/modules/helpdesk/service/rules';
import { getTicket } from '@/modules/helpdesk/service/tickets';
import { Chatter } from '@/modules/chatter/ui/chatter';
import { Button } from '@/ui/primitives/button';
import { formatCell } from '@/ui/views/format';
import { ticketEntity } from '@/modules/helpdesk/entities';

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('helpdesk');
  const currentLocale = await getLocale();
  const result = await withPageCtx((ctx) => getTicket(ctx, id));
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return (
      <div className="p-4 md:p-6">
        <p role="alert" className="text-sm text-destructive">{t('ticket.error')}</p>
      </div>
    );
  }
  const ticket = result.value;
  const stage = ticket.stage as TicketStage;
  const targets = TICKET_STAGES.filter((s) => canTransition(stage, s));

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Link href={`/${currentLocale}/helpdesk`} className="text-sm text-muted hover:underline">
        ← {t('ticket.title')}
      </Link>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-sm text-muted">{ticket.number}</span>
          <h1 className="text-xl font-semibold break-words">{ticket.subject}</h1>
          <span className="text-sm text-muted">{t(`options.stage.${stage}`)}</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {targets.map((s) => (
            <form key={s} action={moveTicketStageForm}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="stage" value={s} />
              <Button type="submit" variant="outline" className="min-h-11">
                {t(`ticket.set.${s}`)}
              </Button>
            </form>
          ))}
        </div>
      </header>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-2xl bg-surface-secondary p-4 sm:grid-cols-2">
        {(['channel', 'priority'] as const).map((name) => {
          const field = ticketEntity.fields.find((f) => f.name === name);
          return (
            <div key={name}>
              <dt className="text-xs text-muted">{t(`fields.${name}`)}</dt>
              <dd className="text-sm">{field ? formatCell(field, ticket[name], currentLocale as 'fr' | 'ar' | 'en') : '–'}</dd>
            </div>
          );
        })}
        {ticket.description ? (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted">{t('fields.description')}</dt>
            <dd className="whitespace-pre-line text-sm">{ticket.description}</dd>
          </div>
        ) : null}
      </dl>

      <section aria-labelledby="ticket-activity" className="flex flex-col gap-3">
        <h2 id="ticket-activity" className="text-base font-semibold">{t('ticket.activity')}</h2>
        <Chatter entity="helpdesk.ticket" recordId={id} />
      </section>
    </div>
  );
}
