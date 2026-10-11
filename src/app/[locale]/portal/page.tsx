import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { requirePortalSession } from '@/core/portal/session-cookie';
import { portalCtx } from '@/core/portal/context';
import { portalHomeSummary } from '@/core/portal/queries';
import { formatDzd } from '@/core/money';
import { canPayOnline } from '@/core/portal/payments';
import { portalPaymentsEnabled } from '@/core/portal/env';

export default async function PortalHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const session = await requirePortalSession(locale);
  const t = await getTranslations('portal');
  const loc = locale as 'fr' | 'ar' | 'en';
  const s = await portalCtx(session, loc, (scope) => portalHomeSummary(scope));

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-semibold">{t('home.greeting', { name: s.partnerName || '—' })}</h1>
        <p className="text-sm text-stone-600">{t('home.subtitle')}</p>
      </section>

      <section aria-label={t('home.balance')} className="grid gap-3 sm:grid-cols-3">
        <Card
          title={t('home.invoicesDue')}
          count={s.invoicesDueCount}
          amount={formatDzd(s.invoicesDueCents, loc)}
          href={`/${locale}/portal/invoices`}
          linkLabel={t('home.viewInvoices')}
        />
        <Card
          title={t('home.installmentsDue')}
          count={s.installmentsDueCount}
          amount={formatDzd(s.installmentsDueCents, loc)}
          href={`/${locale}/portal/contracts`}
          linkLabel={t('home.viewContracts')}
        />
        <Card
          title={t('home.installmentsOverdue')}
          count={s.installmentsOverdueCount}
          amount={formatDzd(s.installmentsOverdueCents, loc)}
          href={`/${locale}/portal/contracts`}
          linkLabel={t('home.viewContracts')}
          alert={s.installmentsOverdueCount > 0}
        />
      </section>

      {portalPaymentsEnabled() ? <PayOnline label={t('pay.online')} hint={t('pay.soon')} enabled={canPayOnline()} /> : null}
    </div>
  );
}

function Card({
  title, count, amount, href, linkLabel, alert = false,
}: { title: string; count: number; amount: string; href: string; linkLabel: string; alert?: boolean }) {
  return (
    <article className={`flex flex-col gap-2 rounded-xl border bg-white p-4 ${alert ? 'border-red-300' : 'border-stone-200'}`}>
      <h2 className="text-sm font-medium text-stone-600">{title}</h2>
      <p className={`text-xl font-semibold tabular-nums ${alert ? 'text-red-700' : ''}`} dir="ltr">{amount}</p>
      <p className="text-sm text-stone-500">{count}</p>
      <Link href={href} className="mt-auto inline-flex min-h-11 items-center text-sm font-medium text-[oklch(0.55_0.11_185)]">
        {linkLabel}
      </Link>
    </article>
  );
}

// Placeholder for online payment. Rendered only when PORTAL_PAYMENTS is on. Disabled until a provider exists.
function PayOnline({ label, hint, enabled }: { label: string; hint: string; enabled: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-stone-300 bg-white p-4">
      <button type="button" disabled={!enabled} className="min-h-11 rounded-lg bg-[oklch(0.55_0.11_185)] px-4 font-medium text-white disabled:opacity-50">
        {label}
      </button>
      {!enabled ? <p className="text-sm text-stone-500">{hint}</p> : null}
    </div>
  );
}
