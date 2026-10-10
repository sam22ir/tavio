import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { buttonVariants } from '@/ui/primitives/button';
import { cn } from '@/ui/lib/cn';
import * as crm from '@/modules/crm/service';
import { saveTeamFormAction, setLeadVisibilityAction } from '@/modules/crm/actions';
import { Button } from '@/ui/primitives/button';
import { TeamForm } from '@/modules/crm/ui/team-form';
import { applyMourabahaAction } from '@/modules/crm/templates/actions';

const KNOWN_SKIPPED = ['automation', 'documents'] as const;
type KnownSkipped = (typeof KNOWN_SKIPPED)[number];

function isKnownSkipped(value: string): value is KnownSkipped {
  return (KNOWN_SKIPPED as readonly string[]).includes(value);
}

function skippedLabels(raw: string, t: (key: 'skippedAutomation' | 'skippedDocuments') => string): string {
  return raw
    .split(',')
    .filter(isKnownSkipped)
    .map((s) => t(s === 'automation' ? 'skippedAutomation' : 'skippedDocuments'))
    .join(', ');
}

export default async function CrmTeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ template?: string; skipped?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('crm.ui');
  const data = await withPageCtx(async (ctx) => {
    const [teams, members, restriction] = await Promise.all([
      crm.listTeams(ctx),
      crm.listMemberOptions(ctx),
      crm.getLeadVisibilityRestriction(ctx),
    ]);
    if (!teams.ok || !members.ok || !restriction.ok) return null;
    return {
      teams: teams.value,
      members: members.value,
      restricted: restriction.value.restricted,
      canManage: ctx.perms.has('crm.lead.write'),
    };
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
          {query.template === 'applied' ? (
            <p role="status" className="rounded-md border p-4 text-sm">
              {t('mourabahaApplied')}
              {query.skipped ? ` ${t('mourabahaSkipped', { steps: skippedLabels(query.skipped, t) })}` : ''}
            </p>
          ) : null}
          {query.template === 'failed' ? (
            <p role="alert" className="rounded-md border p-4 text-sm text-destructive">
              {t('mourabahaFailed')}
            </p>
          ) : null}
          <section className="flex flex-col gap-2 rounded-md border p-4">
            <h2 className="text-base font-semibold">{t('visibilityTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('restrictVisibilityHint')}</p>
            {data.canManage ? (
              <form action={setLeadVisibilityAction} className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="restricted" defaultChecked={data.restricted} />
                  {t('restrictVisibility')}
                </label>
                <Button type="submit" size="sm">
                  {t('saveSetting')}
                </Button>
              </form>
            ) : (
              <p className="text-sm">{data.restricted ? t('restrictVisibility') : t('visibilityOpen')}</p>
            )}
          </section>
          {data.canManage ? (
            <section className="flex flex-col gap-2 rounded-md border p-4">
              <h2 className="text-base font-semibold">{t('mourabahaTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('mourabahaHint')}</p>
              <form action={applyMourabahaAction}>
                <Button type="submit" size="sm" variant="outline">
                  {t('applyMourabaha')}
                </Button>
              </form>
            </section>
          ) : null}
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
