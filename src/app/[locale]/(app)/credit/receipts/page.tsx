import Link from 'next/link';
import { setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { formatDzd } from '@/core/money';
import { formatDate, labels } from '@/modules/credit_sales/print/shared';
import { listReceiptRows } from '@/modules/credit_sales/print/queries';

export default async function ReceiptsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = labels(locale as Locale);
  const rows = await withPageCtx((ctx) => listReceiptRows(ctx));

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t.receipt}</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="flex flex-col">
                <span className="font-medium">
                  {t.number} {r.number} · {r.partnerName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(r.issuedAt, locale as Locale)}
                  {r.state === 'voided' ? ` · ${t.voided}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm tabular-nums">
                  {formatDzd(r.totalCents, locale as Locale)}
                </span>
                <Link href={`/${locale}/credit/receipts/${r.id}/print`} className="text-sm underline">
                  {t.printButton}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
