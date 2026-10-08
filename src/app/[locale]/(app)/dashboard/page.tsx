import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { dashboardKpis } from '@/core/dashboard/kpis';
import { dueTodayAndOverdue } from '@/core/dashboard/due-list';
import { enabledModules } from '@/core/tenancy/service';
import { formatDzd } from '@/core/money';
import { loadShell } from '@/ui/shell/load-shell';
import { Button } from '@/ui/primitives/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/primitives/card';
import { MyActivities } from '@/modules/chatter/ui/my-activities';

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
  const modules = new Set(await enabledModules(shell.active.id));
  const creditOn = modules.has('credit_sales');
  const crmOn = modules.has('crm');

  const { kpis, due } = await withPageCtx(async (ctx) => ({
    kpis: await dashboardKpis(ctx),
    due: creditOn ? await dueTodayAndOverdue(ctx, 5) : [],
  }));

  const money = (c: bigint) => formatDzd(c, locale);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('greeting', { company: shell.active.name })}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label={t('kpi.dueToday')} value={money(kpis.dueTodayCents)} />
        <KpiCard
          label={t('kpi.overdue')}
          value={money(kpis.overdueCents)}
          hint={t('kpi.overdueCount', { count: kpis.overdueCount })}
        />
        <KpiCard label={t('kpi.collectedThisMonth')} value={money(kpis.collectedThisMonthCents)} />
        <KpiCard label={t('kpi.activeContracts')} value={String(kpis.activeContracts)} />
        <KpiCard label={t('kpi.openLeads')} value={String(kpis.openLeads)} />
      </div>

      {creditOn ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('due.title')}</CardTitle>
            <CardDescription>{t('due.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            {due.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('due.empty')}</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {due.map((d) => (
                  <li key={`${d.contractId}-${d.seq}`}>
                    <Link
                      href={`/${locale}/credit/contracts/${d.contractId}`}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm hover:underline"
                    >
                      <span className="font-medium">
                        {d.contractReference} · {t('due.installment', { seq: d.seq })}
                      </span>
                      <span className="text-muted-foreground">
                        {d.dueDate} · {money(d.remainingCents)}
                        {d.daysLate > 0 ? ` · ${t('due.late', { days: d.daysLate })}` : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      <MyActivities limit={8} />

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t('quick.title')}</h2>
        <div className="flex flex-wrap gap-2">
          {creditOn ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/${locale}/credit/contracts/new`}>{t('quick.newContract')}</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/contacts/new`}>{t('quick.newContact')}</Link>
          </Button>
          {crmOn ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/${locale}/crm/new`}>{t('quick.newLead')}</Link>
            </Button>
          ) : null}
        </div>
      </section>
    </section>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}
