import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { routing } from '@/i18n/routing';
import { createTeamForm } from '@/modules/helpdesk/actions';
import { listTeams } from '@/modules/helpdesk/service/teams';
import { teamEntity } from '@/modules/helpdesk/entities';
import { RecordForm } from '@/ui/views/record-form';

export default async function TeamsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('helpdesk');
  const teams = await withPageCtx((ctx) => listTeams(ctx));

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('team.title')}</h1>
      {teams.ok ? (
        <ul className="divide-y rounded-md border">
          {teams.value.length === 0 ? <li className="p-3 text-sm text-muted-foreground">{t('team.empty')}</li> : null}
          {teams.value.map((team) => (
            <li key={team.id} className="p-3 text-sm">{team.name}</li>
          ))}
        </ul>
      ) : (
        <p role="alert" className="text-sm text-destructive">{t('team.error')}</p>
      )}
      <div className="max-w-md">
        <h2 className="mb-3 text-base font-semibold">{t('team.new')}</h2>
        <RecordForm entity={teamEntity} action={createTeamForm} submitLabel={t('team.new')} />
      </div>
    </div>
  );
}
