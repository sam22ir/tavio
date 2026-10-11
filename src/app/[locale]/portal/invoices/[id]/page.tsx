import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { requirePortalSession } from '@/core/portal/session-cookie';
import { portalCtx } from '@/core/portal/context';
import { partnerOwnsPostedInvoice } from '@/core/portal/queries';
import { portalDate } from '@/core/portal/format';
import { canPayOnline } from '@/core/portal/payments';
import { portalPaymentsEnabled } from '@/core/portal/env';
import { formatDzd } from '@/core/money';
import { loadInvoice } from '@/modules/invoicing/service/invoices';
import { paymentsOf } from '@/modules/invoicing/queries';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PortalInvoicePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale) || !UUID_RE.test(id)) notFound();
  setRequestLocale(locale);
  const session = await requirePortalSession(locale);
  const t = await getTranslations('portal');
  const loc = locale as 'fr' | 'ar' | 'en';

  const data = await portalCtx(session, loc, async (scope) => {
    if (!(await partnerOwnsPostedInvoice(scope, id))) return null;
    const loaded = await loadInvoice(scope.ctx, id);
    if (!loaded.ok) return null;
    const payments = await paymentsOf(scope.ctx, id);
    return { ...loaded.value, payments };
  });
  if (!data) notFound();
  const { invoice, lines, payments } = data;
  const balance = invoice.totalCents - invoice.paidCents - invoice.withholdingCents;

  return (
    <article className="flex flex-col gap-5">
      <Link href={`/${locale}/portal/invoices`} className="inline-flex min-h-11 items-center text-sm text-[oklch(0.55_0.11_185)]">
        {t('invoice.back')}
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold" dir="ltr">{invoice.number ?? '—'}</h1>
        <p className="text-sm text-stone-600">
          {t('invoice.date')}: {portalDate(String(invoice.date), locale)}
          {invoice.dueDate ? <> · {t('invoice.dueDate')}: {portalDate(String(invoice.dueDate), locale)}</> : null}
        </p>
        <p className="text-sm">{t('invoice.status')}: {t(`invoices.paymentState.${invoice.paymentState}`)}</p>
      </header>

      <section className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[320px] text-sm">
          <thead className="bg-stone-50 text-start text-stone-600">
            <tr>
              <th className="p-2 text-start font-medium">{t('invoice.description')}</th>
              <th className="p-2 text-end font-medium">{t('invoice.qty')}</th>
              <th className="p-2 text-end font-medium">{t('invoice.lineTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t border-stone-100">
                <td className="p-2">{l.description}</td>
                <td className="p-2 text-end tabular-nums">{String(l.quantity)}</td>
                <td className="p-2 text-end tabular-nums" dir="ltr">{formatDzd(l.subtotalCents + l.taxCents, loc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-4 text-sm">
        <Row label={t('invoice.untaxed')} value={formatDzd(invoice.untaxedCents, loc)} />
        <Row label={t('invoice.tax')} value={formatDzd(invoice.taxCents, loc)} />
        <Row label={t('invoice.total')} value={formatDzd(invoice.totalCents, loc)} strong />
        <Row label={t('invoice.paid')} value={formatDzd(invoice.paidCents, loc)} />
        <Row label={t('invoice.balance')} value={formatDzd(balance < BigInt(0) ? BigInt(0) : balance, loc)} strong />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('invoice.payments')}</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-stone-600">{t('invoice.noPayments')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 rounded-lg border border-stone-200 bg-white p-3 text-sm">
                <span>{portalDate(String(p.date), locale)}</span>
                <span className="tabular-nums" dir="ltr">{formatDzd(p.amountCents, loc)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href={`/${locale}/portal/invoices/${id}/print`} className="inline-flex min-h-11 items-center rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium">
          {t('invoice.print')}
        </Link>
        {portalPaymentsEnabled() ? (
          <button type="button" disabled={!canPayOnline()} className="min-h-11 rounded-lg bg-[oklch(0.55_0.11_185)] px-4 text-sm font-medium text-white disabled:opacity-50">
            {t('pay.online')}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? 'font-semibold' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums" dir="ltr">{value}</span>
    </div>
  );
}
