import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { searchPartnerOptions } from '@/modules/contacts/actions';
import { createTicketForm } from '@/modules/helpdesk/actions';
import { listTeams } from '@/modules/helpdesk/service/teams';
import { RecordForm } from '@/ui/views/record-form';
import { TICKET_FORM_ENTITY } from '../_lib/form-entity';

export default async function NewTicketPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('helpdesk');
  const partners = await searchPartnerOptions();
  const teams = await withPageCtx((ctx) => listTeams(ctx));
  const teamOptions = teams.ok ? teams.value.map((team) => ({ value: team.id, label: team.name })) : [];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('ticket.new')}</h1>
      <div className="max-w-2xl">
        <RecordForm
          entity={TICKET_FORM_ENTITY}
          action={createTicketForm}
          submitLabel={t('ticket.new')}
          relationOptions={{ partnerId: partners, teamId: teamOptions }}
        />
      </div>
    </div>
  );
}
