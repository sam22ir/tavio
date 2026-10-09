import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { dueTodayAndOverdue } from '@/core/dashboard/due-list';
import { enabledModules } from '@/core/tenancy/service';
import { formatDzd } from '@/core/money';
import { loadShell } from '@/ui/shell/load-shell';
import { AppTiles } from '@/ui/shell/app-tiles';
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
  const tPillar = await getTranslations('shell.pillars');
  const tAll = await getTranslations();
  const modules = new Set(await enabledModules(shell.active.id));
  const creditOn = modules.has('credit_sales');

  const due = creditOn ? await withPageCtx((ctx) => dueTodayAndOverdue(ctx, 5)) : [];

  const name = shell.email.split('@')[0] || shell.email;
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  const money = (c: bigint) => formatDzd(c, locale);

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t('hello', { name })}</h1>
        <p className="text-muted-foreground">{dateLabel}</p>
      </header>

      <section className="app-panel flex flex-col gap-5 p-5 md:p-6">
        <h2 className="text-lg font-semibold">{t('today')}</h2>
        {creditOn ? (
          due.length === 0 ? null : (
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
          )
        ) : null}
        <MyActivities limit={8} />
      </section>

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
