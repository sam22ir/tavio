import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { requireFullPortalSession } from '@/core/portal/session-cookie';
import { portalCtx } from '@/core/portal/context';
import { listPortalInvoices } from '@/core/portal/queries';
import { portalDate } from '@/core/portal/format';
import { formatDzd } from '@/core/money';

export default async function PortalInvoicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const session = await requireFullPortalSession(locale);
  const t = await getTranslations('portal');
  const loc = locale as 'fr' | 'ar' | 'en';
  const rows = await portalCtx(session, loc, (scope) => listPortalInvoices(scope));

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t('invoices.title')}</h1>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">{t('invoices.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/${locale}/portal/invoices/${r.id}`} className="flex min-h-11 flex-col gap-1 rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-400">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium" dir="ltr">{r.number ?? '—'}</span>
                  <span className="text-sm text-stone-600">{t(`invoices.paymentState.${r.paymentState}`)}</span>
                </span>
                <span className="flex items-center justify-between gap-2 text-sm text-stone-600">
                  <span>{portalDate(r.date, locale)}</span>
                  <span className="font-medium tabular-nums text-stone-900" dir="ltr">{formatDzd(r.totalCents, loc)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
