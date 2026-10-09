import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { buttonVariants } from '@/ui/primitives/button';
import { cn } from '@/ui/lib/cn';
import * as crm from '@/modules/crm/service';
import { saveTeamFormAction } from '@/modules/crm/actions';
import { TeamForm } from '@/modules/crm/ui/team-form';

export default async function CrmTeamsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('crm.ui');
  const data = await withPageCtx(async (ctx) => {
    const [teams, members] = await Promise.all([crm.listTeams(ctx), crm.listMemberOptions(ctx)]);
    if (!teams.ok || !members.ok) return null;
    return { teams: teams.value, members: members.value, canManage: ctx.perms.has('crm.lead.write') };
  });

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t('teamsTitle')}</h1>
        <Link href={`/${locale}/crm/list`} className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
          {t('back')}
        </Link>
      </div>

      {!data ? (
        <p role="alert" className="rounded-md border p-4 text-sm text-destructive">
          {t('loadError')}
        </p>
      ) : (
        <>
          {data.teams.length === 0 ? <p className="text-sm text-muted-foreground">{t('noTeams')}</p> : null}
          {data.canManage
            ? data.teams.map((team) => (
                <TeamForm key={team.id} team={team} members={data.members} action={saveTeamFormAction} />
              ))
            : data.teams.map((team) => (
                <div key={team.id} className="rounded-md border p-4 text-sm">
                  {team.name}
                </div>
              ))}
          {data.canManage ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-base font-semibold">{t('newTeam')}</h2>
              <TeamForm members={data.members} action={saveTeamFormAction} />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
