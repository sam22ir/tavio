import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { formatDzd } from '@/core/money';
import type { Locale } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { CreditCard, Landmark, Receipt, Wallet } from 'lucide-react';
import { StatusChip, TintIcon, type Tint } from '@/ui/blocks/tint';
import { routing } from '@/i18n/routing';
import { SAAS_PLAN_SEED, monthlyTotalCents } from '@/modules/subscriptions';
import { getCurrentSubscription } from '@/modules/subscriptions/service/subscription';

const READ = 'subscriptions.subscription.read';

export default async function BillingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations('subscriptions');
  const currentLocale = (await getLocale()) as Locale;

  const current = await withPageCtx(async (ctx) => {
    const perm = requirePerm(ctx, READ);
    if (!perm.ok) return null;
    return getCurrentSubscription(ctx);
  });

  if (!current) {
    return <p role="alert" className="rounded-2xl bg-tint-danger p-4 text-sm text-tint-danger-fg">{t('forbidden')}</p>;
  }

  // No row means the company is on the Free plan.
  const freeSeed = SAAS_PLAN_SEED[0]!;
  const planName = current.plan?.name ?? freeSeed.name;
  const seats = current.subscription?.seats ?? 1;
  const state = current.subscription?.state ?? 'trial';
  const seedPlan = SAAS_PLAN_SEED.find((p) => p.code === current.plan?.code) ?? freeSeed;
  const monthly = formatDzd(monthlyTotalCents(seedPlan, seats), currentLocale);

  const fmtDate = (d: Date) => new Intl.DateTimeFormat(currentLocale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  const now = new Date();
  const daysUntil = (d: Date) => Math.max(0, Math.ceil((d.getTime() - now.getTime()) / 86_400_000));
  const trialEnds = current.subscription?.trialEndsAt ?? null;
  const periodEnds = current.subscription?.currentPeriodEnd ?? null;
  const stateTint = { trial: 'info', active: 'success', past_due: 'danger', cancelled: 'neutral' }[state] as Tint;
  const payments = [
    { icon: Landmark, text: t('payment.ccp') },
    { icon: Wallet, text: t('payment.transfer') },
    { icon: Receipt, text: t('payment.reference') },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted">{t('subtitle')}</p>
      </header>

      <section className="app-panel flex flex-col gap-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <TintIcon icon={CreditCard} tint="info" className="size-12" />
            <div>
              <p className="text-sm text-muted">{t('plan')}</p>
              <p className="text-2xl font-semibold tracking-tight">{planName}</p>
            </div>
          </div>
          <StatusChip tint={stateTint}>{t(`states.${state}`)}</StatusChip>
        </div>

        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={t('monthly')} value={monthly} />
          <Stat label={t('seats')} value={String(seats)} />
          {trialEnds ? (
            <Stat label={t('trialEnds')} value={fmtDate(trialEnds)} hint={t('daysLeft', { count: daysUntil(trialEnds) })} />
          ) : null}
          {periodEnds ? (
            <Stat label={t('periodEnds')} value={fmtDate(periodEnds)} hint={t('daysLeft', { count: daysUntil(periodEnds) })} />
          ) : null}
        </dl>
      </section>

      <section className="app-panel flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">{t('payment.title')}</h2>
        <ul className="flex flex-col gap-3">
          {payments.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <TintIcon icon={Icon} tint="neutral" className="size-9" />
              <span className="pt-2 leading-snug">{text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-surface-secondary p-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-semibold tracking-tight tabular-nums">{value}</dd>
      {hint ? <dd className="text-xs text-muted">{hint}</dd> : null}
    </div>
  );
}
