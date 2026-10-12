import Link from 'next/link';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Landmark } from 'lucide-react';
import { routing, type Locale } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { formatDzd, type Cents } from '@/core/money';
import { can } from '@/core/perms';
import { Panel } from '@/ui/blocks/feed';
import { StatusChip, TintIcon, type Tint } from '@/ui/blocks/tint';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/primitives/table';
import { listBatches } from '@/modules/credit_sales/service/debits';
import { NewBatchForm } from '@/modules/credit_sales/ui/debit-controls';

const BATCH_TINT: Record<string, Tint> = { draft: 'neutral', exported: 'info', closed: 'success', cancelled: 'neutral' };

function currentMonthAlgiers(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
}

export default async function DebitsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const t = await getTranslations('credit');

  const data = await withPageCtx(async (ctx) => {
    if (!can(ctx.perms, 'credit_sales.payment.read')) return null;
    return { batches: await listBatches(ctx), canWrite: can(ctx.perms, 'credit_sales.payment.write') };
  });
  if (!data) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start gap-3">
        <TintIcon icon={Landmark} tint="info" className="mt-1 size-11" />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('debits.title')}</h1>
          <p className="max-w-3xl text-sm text-muted">{t('debits.intro')}</p>
          <p className="max-w-3xl text-xs text-muted">{t('debits.templateNote')}</p>
        </div>
      </header>

      {data.canWrite ? (
        <Panel title={t('debits.newBatch')}>
          <NewBatchForm defaultMonth={currentMonthAlgiers()} />
        </Panel>
      ) : null}

      <section className="app-panel flex flex-col gap-4 p-5">
        {data.batches.length === 0 ? (
          <p className="rounded-2xl bg-surface-secondary p-8 text-center text-sm text-muted">{t('debits.empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-surface-secondary/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('debits.cols.number')}</TableHead>
                  <TableHead>{t('debits.cols.month')}</TableHead>
                  <TableHead>{t('debits.cols.status')}</TableHead>
                  <TableHead>{t('debits.cols.items')}</TableHead>
                  <TableHead>{t('debits.cols.progress')}</TableHead>
                  <TableHead className="text-end">{t('debits.cols.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link href={`/credit/debits/${b.id}`} className="font-medium underline">
                        {b.number}
                      </Link>
                    </TableCell>
                    <TableCell dir="ltr" className="text-start">{b.periodMonth.slice(0, 7)}</TableCell>
                    <TableCell>
                      <StatusChip tint={BATCH_TINT[b.status] ?? 'neutral'}>{t(`debits.batch.${b.status}`)}</StatusChip>
                    </TableCell>
                    <TableCell className="tabular-nums">{b.items}</TableCell>
                    <TableCell className="text-sm text-muted">
                      {t('debits.summary.paid')} {b.paid} · {t('debits.summary.rejected')} {b.rejected}
                      {b.needsReview > 0 ? ` · ${t('debits.summary.review')} ${b.needsReview}` : ''}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{formatDzd(b.totalCents as Cents, loc)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
