import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { requirePortalSession } from '@/core/portal/session-cookie';
import { portalCtx } from '@/core/portal/context';
import { partnerOwnsContract } from '@/core/portal/queries';
import { portalDate } from '@/core/portal/format';
import { formatDzd } from '@/core/money';
import { getContract } from '@/modules/credit_sales/service/contracts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Installment status shown to the customer: paid, due (not yet late) or overdue.
function customerStatus(status: 'upcoming' | 'partial' | 'paid' | 'late'): 'paid' | 'due' | 'overdue' {
  if (status === 'paid') return 'paid';
  if (status === 'late') return 'overdue';
  return 'due';
}

export default async function PortalContractPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale) || !UUID_RE.test(id)) notFound();
  setRequestLocale(locale);
  const session = await requirePortalSession(locale);
  const t = await getTranslations('portal');
  const loc = locale as 'fr' | 'ar' | 'en';

  const data = await portalCtx(session, loc, async (scope) => {
    if (!(await partnerOwnsContract(scope, id))) return null;
    const res = await getContract(scope.ctx, id);
    if (!res.ok) return null;
    return res.value;
  });
  if (!data) notFound();
  const { contract, installments, payments, receipts, totals } = data;

  return (
    <article className="flex flex-col gap-5">
      <Link href={`/${locale}/portal/contracts`} className="inline-flex min-h-11 items-center text-sm text-[oklch(0.55_0.11_185)]">
        {t('contract.back')}
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold" dir="ltr">{contract.reference}</h1>
        <p className="text-sm">{t('contract.state')}: {t(`contracts.states.${contract.state}`)}</p>
      </header>

      <section className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-4 text-sm">
        <Row label={t('contract.total')} value={formatDzd(contract.totalCents, loc)} />
        <Row label={t('contract.financed')} value={formatDzd(contract.financedCents, loc)} />
        <Row label={t('contract.paid')} value={formatDzd(totals.paidCents, loc)} />
        <Row label={t('contract.remaining')} value={formatDzd(totals.remainingCents, loc)} strong />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('contract.schedule')}</h2>
        <ul className="flex flex-col gap-2">
          {installments.map((i) => {
            const status = customerStatus(i.status);
            return (
              <li key={i.id} className="flex flex-col gap-1 rounded-lg border border-stone-200 bg-white p-3 text-sm">
                <span className="flex items-center justify-between gap-2">
                  <span>#{i.seq} · {portalDate(i.dueDate, locale)}</span>
                  <span className={status === 'overdue' ? 'font-medium text-red-700' : 'text-stone-600'}>{t(`status.${status}`)}</span>
                </span>
                <span className="flex items-center justify-between gap-2 tabular-nums text-stone-600" dir="ltr">
                  <span>{formatDzd(i.paidCents, loc)} / {formatDzd(i.amountCents, loc)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t('contract.payments')}</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-stone-600">{t('contract.noPayments')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 rounded-lg border border-stone-200 bg-white p-3 text-sm">
                <span>{portalDate(p.receivedAt.toISOString(), locale)}</span>
                <span className="tabular-nums" dir="ltr">{formatDzd(p.amountCents, loc)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {receipts.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t('contract.receipts')}</h2>
          <ul className="flex flex-col gap-2">
            {receipts.map((r) => (
              <li key={r.id}>
                <Link href={`/${locale}/portal/receipts/${r.id}/print`} className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white p-3 text-sm">
                  <span dir="ltr">{r.number}</span>
                  <span className="text-[oklch(0.55_0.11_185)]">{t('receipts.print')}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div>
        <Link href={`/${locale}/portal/contracts/${id}/print`} className="inline-flex min-h-11 items-center rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium">
          {t('contract.print')}
        </Link>
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
