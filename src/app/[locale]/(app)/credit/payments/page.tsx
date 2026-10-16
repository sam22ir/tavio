import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { withPageCtx } from '@/core/actions/page-ctx';
import { parseListQuery } from '@/core/entities/list-query';
import { DataList } from '@/ui/views/data-list';
import { paymentEntity } from '@/modules/credit_sales/entities';
import { listPayments } from '@/modules/credit_sales/service/payments';

export default async function PaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('credit');
  const sp = await searchParams;

  const { query, result } = await withPageCtx(async (ctx) => {
    const q = parseListQuery(sp, paymentEntity);
    return { query: q, result: await listPayments(ctx, q) };
  });

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('menu.payments')}</h1>
      <DataList
        entity={paymentEntity}
        result={result}
        query={query}
        basePath="/credit/payments"
        rowHref={(r) => `/credit/receipts/${String(r.receiptId)}`}
        actions={
          <Link href="/credit/overdue" className="text-sm underline">
            {t('menu.overdue')}
          </Link>
        }
      />
    </section>
  );
}
