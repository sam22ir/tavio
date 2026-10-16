import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { parseListQuery } from '@/core/entities/list-query';
import { DataList } from '@/ui/views/data-list';
import { Button } from '@/ui/primitives/button';
import { listContracts } from '@/modules/credit_sales/service/contracts';
import { contractEntity } from '@/modules/credit_sales/entities';

export default async function ContractsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const sp = await searchParams;
  const query = parseListQuery(sp, contractEntity);
  const t = await getTranslations('credit');
  const basePath = `/${locale}/credit/contracts`;

  const result = await withPageCtx((ctx) => listContracts(ctx, query));
  // The service returns partnerName; DataList reads the relation label as `${field}Label`.
  const rows = result.rows.map((r) => ({ ...r, partnerIdLabel: r.partnerName }));

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t('contract.title')}</h1>
        <Button asChild>
          <Link href={`${basePath}/new`}>{t('contract.new')}</Link>
        </Button>
      </div>

      <DataList
        entity={contractEntity}
        result={{ ...result, rows }}
        query={query}
        basePath={basePath}
        rowHref={(r) => `${basePath}/${String(r.id)}`}
      />
    </section>
  );
}

