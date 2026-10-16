import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { AlertTriangle, CalendarClock, ListTodo, Target, Wallet } from 'lucide-react';
import { routing, type Locale } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { dashboardKpis } from '@/core/dashboard/kpis';
import { dueTodayAndOverdue } from '@/core/dashboard/due-list';
import { enabledModules } from '@/core/tenancy/service';
import { formatDzd } from '@/core/money';
import { loadShell } from '@/ui/shell/load-shell';
import { AppTiles } from '@/ui/shell/app-tiles';
import { AssistantPanel } from '@/ui/blocks/assistant-panel';
import { FeedRow, Panel } from '@/ui/blocks/feed';
import { KpiTile } from '@/ui/blocks/kpi-tile';
import { StatusChip } from '@/ui/blocks/tint';
import { stageLabel } from '@/modules/crm/stage-names';
import { myOpenActivities } from '@/modules/chatter/service';
import { MyActivities } from '@/modules/chatter/ui/my-activities';
import { parseActivityFilter } from '@/modules/chatter/ui/activity-filter';
import { companyIsDemo, homeCompanyOf } from '@/core/tenancy/service';
import { SampleDataBanner } from '@/core/demo/sample-data-banner';
import { GettingStartedChecklist } from '@/core/demo/getting-started-checklist';
import { tenantForUser } from '@/core/tenancy/tenant-access';

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ activities?: string | string[] }>;
}) {
  const { locale: rawLocale } = await params;
  const { activities: rawFilter } = await searchParams;
  if (!hasLocale(routing.locales, rawLocale)) notFound();
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  const shell = await loadShell(locale);
  const t = await getTranslations('shell.dashboard');
  const tPillar = await getTranslations('shell.pillars');
  const tAll = await getTranslations();
  const modules = new Set(await enabledModules(shell.active.id));
  const creditOn = modules.has('credit_sales');
  const crmOn = modules.has('crm');

  const tenant = await tenantForUser({ locale, companyId: shell.active.id });
  const demo = await companyIsDemo(shell.active.id);
  const home = demo && tenant.ok ? await homeCompanyOf(tenant.value.userId) : null;

  const { name, kpis, due, activities } = await withPageCtx(async (ctx) => {
    // users is not readable by the app role; member_directory is the tenant-scoped view of members.
    const [member] = await ctx.tx
      .select({ name: sql<string>`member_directory.name` })
      .from(sql`member_directory`)
      .where(sql`member_directory.user_id = ${ctx.userId} and member_directory.company_id = ${ctx.companyId}`);
    return {
      name: displayName(member?.name?.trim() || shell.email.split('@')[0] || shell.email, locale),
      kpis: await dashboardKpis(ctx),
      due: creditOn ? await dueTodayAndOverdue(ctx, 5) : [],
      activities: await myOpenActivities(ctx, 100),
    };
  });

  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  const money = (c: bigint) => formatDzd(c, locale);
  const activityFilter = parseActivityFilter(typeof rawFilter === 'string' ? rawFilter : undefined);

  const hasAssistant = shell.apps.some((a) => a.id === 'ai_features');
  const tiles = [
    ...(creditOn
      ? [
          <KpiTile
            key="due"
            label={t('kpi.dueToday')}
            value={String(kpis.dueTodayCount)}
            hint={money(kpis.dueTodayCents)}
            icon={CalendarClock}
            tint="info"
            href={`/${locale}/credit/overdue`}
          />,
          <KpiTile
            key="overdue"
            label={t('kpi.overdue')}
            value={String(kpis.overdueCount)}
            hint={money(kpis.overdueCents)}
            icon={AlertTriangle}
            tint={kpis.overdueCount > 0 ? 'danger' : 'success'}
            href={`/${locale}/credit/overdue`}
          />,
          <KpiTile
            key="collected"
            label={t('kpi.collectedThisMonth')}
            value={money(kpis.collectedThisMonthCents)}
            icon={Wallet}
            tint="success"
          />,
        ]
      : []),
    ...(crmOn
      ? [<KpiTile key="leads" label={t('kpi.openLeads')} value={String(kpis.openLeads)} icon={Target} tint="violet" href={`/${locale}/crm`} />]
      : []),
    <KpiTile
      key="activities"
      label={t('pipeline.overdueActivities')}
      value={String(kpis.overdueActivities)}
      icon={ListTodo}
      tint={kpis.overdueActivities > 0 ? 'warning' : 'neutral'}
    />,
  ].slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-light tracking-tight md:text-4xl">{t('hello', { name })}</h1>
        <p className="text-sm text-muted">{dateLabel}</p>
      </header>

      <SampleDataBanner
        demo={demo}
        demoCompanyId={shell.active.id}
        realCompany={home ? { id: home.id, name: home.name } : null}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">{tiles}</div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t('needsYou')} className="lg:col-span-2">
          {creditOn ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{t('lists.due')}</h3>
                <Link href={`/${locale}/credit/overdue`} className="text-xs font-medium text-accent hover:underline">
                  {t('viewAll')}
                </Link>
              </div>
              {due.length === 0 ? (
                <p className="py-2 text-sm text-muted">{t('due.empty')}</p>
              ) : (
                <ul className="flex flex-col">
                  {due.map((d) => (
                    <FeedRow
                      key={`${d.contractId}-${d.seq}`}
                      href={`/${locale}/credit/contracts/${d.contractId}`}
                      icon={CalendarClock}
                      tint={d.daysLate > 0 ? 'danger' : 'info'}
                      title={d.contractReference}
                      subtitle={d.clientName}
                      meta={
                        <>
                          <span>{money(d.remainingCents)}</span>
                          {d.daysLate > 0 ? <StatusChip tint="danger">{t('due.late', { days: d.daysLate })}</StatusChip> : null}
                        </>
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          <div className="min-w-0">
            <MyActivities rows={activities} limit={5} filter={activityFilter} basePath={`/${locale}/dashboard`} />
          </div>
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          {hasAssistant ? (
            <AssistantPanel
              href={`/${locale}/assistant`}
              title={t('assistant.title')}
              hint={t('assistant.hint')}
              openLabel={t('assistant.open')}
              prompts={[t('assistant.prompts.overdue'), t('assistant.prompts.collected'), t('assistant.prompts.leads')]}
            />
          ) : null}
          {!demo && <GettingStartedChecklist locale={locale} />}
        </div>
      </div>

      {crmOn ? (
        <Panel title={t('pipeline.title')}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCell label={t('pipeline.withoutActivity')} value={String(kpis.leads.openWithoutActivity)} danger={kpis.leads.openWithoutActivity > 0} />
            <StatCell label={t('pipeline.avgDays')} value={kpis.leads.avgDaysInStage.toFixed(1)} />
            <StatCell label={t('pipeline.wonThisMonth')} value={String(kpis.leads.wonThisMonth)} />
            <StatCell
              label={t('pipeline.conversion')}
              value={kpis.leads.conversionRate === null ? '—' : `${Math.round(kpis.leads.conversionRate * 100)}%`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold">{t('pipeline.openByStage')}</h3>
            {kpis.leads.openByStage.length === 0 ? (
              <p className="py-2 text-sm text-muted">{t('pipeline.noStages')}</p>
            ) : (
              <ul className="flex flex-col gap-3 pt-1">
                {kpis.leads.openByStage.map((s) => {
                  const max = Math.max(...kpis.leads.openByStage.map((x) => x.count), 1);
                  return (
                    <li key={s.stageId} className="flex flex-col gap-1.5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate">{stageLabel(s.name, locale)}</span>
                        <span className="shrink-0 font-semibold tabular-nums">{s.count}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-default" aria-hidden="true">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max((s.count / max) * 100, s.count > 0 ? 6 : 0)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Panel>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">{t('applications')}</h2>
        {shell.apps.length === 0 ? (
          <p className="text-sm text-muted">{t('applicationsEmpty')}</p>
        ) : (
          <AppTiles
            apps={shell.apps}
            pillarLabel={(p) => tPillar(p)}
            labelOf={(key) => (tAll.has(key) ? tAll(key) : key)}
          />
        )}
      </section>
    </div>
  );
}

/** Names typed in capitals ("SAMIR SAADI") read as shouting in a greeting; title-case them. */
function displayName(raw: string, locale: string): string {
  if (raw !== raw.toLocaleUpperCase(locale) || raw === raw.toLocaleLowerCase(locale)) return raw;
  return raw
    .toLocaleLowerCase(locale)
    .replace(/(^|[\s'’-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase(locale));
}

function StatCell({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-surface-secondary p-3 sm:p-4">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-2xl font-semibold tabular-nums ${danger ? 'text-danger' : ''}`}>{value}</span>
    </div>
  );
}
