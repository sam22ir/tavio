import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { routing, type Locale } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { dashboardKpis } from '@/core/dashboard/kpis';
import { dueTodayAndOverdue } from '@/core/dashboard/due-list';
import { enabledModules } from '@/core/tenancy/service';
import { formatDzd } from '@/core/money';
import { loadShell } from '@/ui/shell/load-shell';
import { AppTiles } from '@/ui/shell/app-tiles';
import { myOpenActivities, todayIso } from '@/modules/chatter/service';
import { hasSampleData } from '@/core/demo/sample-data';
import { SampleDataBanner } from '@/core/demo/sample-data-banner';
import { GettingStartedChecklist } from '@/core/demo/getting-started-checklist';
import { tenantForUser } from '@/core/tenancy/tenant-access';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!hasLocale(routing.locales, rawLocale)) notFound();
  setRequestLocale(rawLocale);
  const locale = rawLocale as Locale;

  const shell = await loadShell(locale);
  const t = await getTranslations('shell.dashboard');
  const tActivity = await getTranslations('chatter.activity');
  const tPillar = await getTranslations('shell.pillars');
  const tAll = await getTranslations();
  const modules = new Set(await enabledModules(shell.active.id));
  const creditOn = modules.has('credit_sales');

  const tenant = await tenantForUser({ locale, companyId: shell.active.id });
  const sampleActive = tenant.ok ? await hasSampleData(tenant.value) : false;

  const { name, kpis, due, activities } = await withPageCtx(async (ctx) => {
    // users is not readable by the app role; member_directory is the tenant-scoped view of members.
    const [member] = await ctx.tx
      .select({ name: sql<string>`member_directory.name` })
      .from(sql`member_directory`)
      .where(sql`member_directory.user_id = ${ctx.userId} and member_directory.company_id = ${ctx.companyId}`);
    return {
      name: member?.name?.trim() || shell.email.split('@')[0] || shell.email,
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
  const today = todayIso();
  const topActivities = activities.slice(0, 5);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t('hello', { name })}</h1>
        <p className="text-sm text-muted-foreground">{dateLabel}</p>
      </header>

      <SampleDataBanner active={sampleActive} />

      <section className="app-panel flex flex-col gap-5 p-5">
        <h2 className="text-lg font-semibold">{t('today')}</h2>
        <div className="flex flex-wrap gap-2">
          <Chip label={t('chips.dueToday')} value={String(kpis.dueTodayCount)} />
          <Chip label={t('chips.overdue')} value={String(kpis.overdueCount)} danger={kpis.overdueCount > 0} />
          <Chip label={t('chips.activities')} value={String(activities.length)} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {creditOn ? (
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{t('lists.due')}</h3>
                <Link href={`/${locale}/credit/overdue`} className="text-xs font-medium text-primary hover:underline">
                  {t('viewAll')}
                </Link>
              </div>
              {due.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">{t('due.empty')}</p>
              ) : (
                <ul className="flex flex-col divide-y">
                  {due.map((d) => (
                    <li key={`${d.contractId}-${d.seq}`}>
                      <Link
                        href={`/${locale}/credit/contracts/${d.contractId}`}
                        className="flex items-center justify-between gap-3 py-2 text-sm hover:underline"
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{d.contractReference}</span>
                          {d.clientName ? <span className="text-muted-foreground"> · {d.clientName}</span> : null}
                        </span>
                        <span className="flex shrink-0 items-center gap-2 tabular-nums">
                          <span>{money(d.remainingCents)}</span>
                          {d.daysLate > 0 ? (
                            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                              {t('due.late', { days: d.daysLate })}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="text-sm font-semibold">{t('lists.activities')}</h3>
            {topActivities.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">{tActivity('noActivities')}</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {topActivities.map((a) => {
                  const overdue = a.dueDate < today;
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{a.summary}</span>
                      <span className={`shrink-0 text-xs tabular-nums ${overdue ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                        {a.dueDate}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      <GettingStartedChecklist locale={locale} />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t('applications')}</h2>
        {shell.apps.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('applicationsEmpty')}</p>
        ) : (
          <AppTiles
            apps={shell.apps}
            pillarLabel={(p) => tPillar(p)}
            labelOf={(key) => (tAll.has(key) ? tAll(key) : key)}
          />
        )}
      </section>
    </section>
  );
}

function Chip({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
        danger ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'
      }`}
    >
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
