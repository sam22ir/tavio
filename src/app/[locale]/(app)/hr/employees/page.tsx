import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { withPageCtx } from '@/core/actions/page-ctx';
import { parseListQuery } from '@/core/entities/list-query';
import { routing } from '@/i18n/routing';
import { employeeEntity } from '@/modules/hr/entities';
import { listEmployees } from '@/modules/hr/service/employees';
import { buttonVariants } from '@/ui/primitives/button';
import { DataList } from '@/ui/views/data-list';
import { cn } from '@/ui/lib/cn';

export default async function EmployeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, employeeEntity);
  const result = await withPageCtx((ctx) => listEmployees(ctx, query));
  const t = await getTranslations('hr');
  const currentLocale = await getLocale();

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('employee.title')}</h1>
      {result.ok ? (
        <DataList
          entity={employeeEntity}
          result={result.value}
          query={query}
          basePath={`/${currentLocale}/hr/employees`}
          rowHref={(row) => `/${currentLocale}/hr/employees/${row.id}`}
          actions={
            <Link href={`/${currentLocale}/hr/employees/new`} className={cn(buttonVariants())}>
              {t('employee.new')}
            </Link>
          }
        />
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {t('employee.error')}
        </p>
      )}
    </div>
  );
}
