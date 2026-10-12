import { setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { getStatementView } from '@/modules/accounting/service/bank-statements';
import { toStatementDto } from '@/modules/accounting/ui/reconciliation-dto';
import { StatementWorkbench } from '@/modules/accounting/ui/statement-workbench';

export default async function StatementPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const view = await withPageCtx((ctx) => getStatementView(ctx, id));
  if (!view.ok) notFound();
  const dto = toStatementDto(view.value);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{`${dto.name} · ${dto.accountCode}`}</h1>
      <p className="text-sm text-muted-foreground">{`${dto.dateFrom} → ${dto.dateTo}`}</p>
      <StatementWorkbench statement={dto} />
    </div>
  );
}
