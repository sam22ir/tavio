import { setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { loadContractPrint } from '@/modules/credit_sales/print/queries';
import { labels } from '@/modules/credit_sales/print/shared';
import { PrintButton } from '@/modules/credit_sales/print/print-button';
import { ContractView } from '@/modules/credit_sales/print/views';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ContractPrintPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale) || !UUID_RE.test(id)) notFound();
  setRequestLocale(locale);

  const input = await withPageCtx((ctx) => loadContractPrint(ctx, id));
  if (!input) notFound();

  const t = labels(locale as Locale);
  return (
    <div className="flex flex-col gap-4">
      <PrintButton label={t.printButton} />
      <ContractView input={input} />
    </div>
  );
}
