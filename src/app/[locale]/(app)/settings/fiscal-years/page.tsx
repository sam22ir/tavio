import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { ensureDefaults } from '@/modules/accounting/service/chart';
import { listFiscalYears } from '@/modules/accounting/service/fiscal';
import { getLockDate } from '@/modules/accounting/service/period';
import { FiscalYearsPanel } from '@/modules/accounting/ui/fiscal-years-panel';

export default async function FiscalYearsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const { years, lockDate } = await withPageCtx(async (ctx) => {
    await ensureDefaults(ctx);
    const list = await listFiscalYears(ctx);
    return { years: list, lockDate: await getLockDate(ctx) };
  });
  const t = await getTranslations('accounting');

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('fiscalYears.title')}</h1>
      <FiscalYearsPanel
        years={years.map((y) => ({ id: y.id, name: y.name, startDate: y.startDate, endDate: y.endDate, state: y.state === 'closed' ? 'closed' : 'open' }))}
        lockDate={lockDate}
      />
    </div>
  );
}
