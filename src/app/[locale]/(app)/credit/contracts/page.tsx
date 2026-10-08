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

const STATES = ['draft', 'active', 'completed', 'cancelled', 'defaulted'] as const;

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
        <h1 className="text-2xl font-semibold">{t('contract.title')}</h1>
        <Button asChild>
          <Link href={`${basePath}/new`}>{t('contract.new')}</Link>
        </Button>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          {t('fields.state')}
          <select name="f_state" defaultValue={query.filters.state ?? ''} className="h-9 rounded-md border bg-background px-3">
            <option value="">{t('contract.allStates')}</option>
            {STATES.map((s) => (
              <option key={s} value={s}>{t(`options.state.${s}`)}</option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">{t('contract.filter')}</Button>
      </form>

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

