import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { formatDzd } from '@/core/money';
import type { Locale } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
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
    return <div className="p-4 md:p-6"><p role="alert" className="text-sm text-destructive">{t('forbidden')}</p></div>;
  }

  // No row means the company is on the Free plan.
  const freeSeed = SAAS_PLAN_SEED[0]!;
  const planName = current.plan?.name ?? freeSeed.name;
  const seats = current.subscription?.seats ?? 1;
  const state = current.subscription?.state ?? 'trial';
  const seedPlan = SAAS_PLAN_SEED.find((p) => p.code === current.plan?.code) ?? freeSeed;
  const monthly = formatDzd(monthlyTotalCents(seedPlan, seats), currentLocale);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <section className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <div>
          <p className="text-sm text-muted-foreground">{t('plan')}</p>
          <p className="font-medium">{planName}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{t('state')}</p>
          <p className="font-medium">{t(`states.${state}`)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{t('seats')}</p>
          <p className="font-medium">{seats}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{t('monthly')}</p>
          <p className="font-medium">{monthly}</p>
        </div>
        {current.subscription?.trialEndsAt ? (
          <div>
            <p className="text-sm text-muted-foreground">{t('trialEnds')}</p>
            <p className="font-medium">{current.subscription.trialEndsAt.toISOString().slice(0, 10)}</p>
          </div>
        ) : null}
        {current.subscription?.currentPeriodEnd ? (
          <div>
            <p className="text-sm text-muted-foreground">{t('periodEnds')}</p>
            <p className="font-medium">{current.subscription.currentPeriodEnd.toISOString().slice(0, 10)}</p>
          </div>
        ) : null}
      </section>
      <section className="flex flex-col gap-2 rounded-lg border p-4">
        <h2 className="font-medium">{t('payment.title')}</h2>
        <p className="text-sm">{t('payment.ccp')}</p>
        <p className="text-sm">{t('payment.transfer')}</p>
        <p className="text-sm text-muted-foreground">{t('payment.reference')}</p>
      </section>
    </div>
  );
}
