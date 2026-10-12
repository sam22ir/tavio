import Link from 'next/link';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AlertTriangle, CheckCircle2, ListChecks, Wallet, XCircle } from 'lucide-react';
import { routing, type Locale } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { formatDzd, type Cents } from '@/core/money';
import { can } from '@/core/perms';
import { maskCcpAccount } from '@/modules/credit_sales/service/debit-file';
import { KpiTile } from '@/ui/blocks/kpi-tile';
import { StatusChip, type Tint } from '@/ui/blocks/tint';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/primitives/table';
import { getBatch } from '@/modules/credit_sales/service/debits';
import { BatchToolbar, DebitDateProvider, ItemActions } from '@/modules/credit_sales/ui/debit-controls';

const ITEM_TINT: Record<string, Tint> = { pending: 'warning', paid: 'success', rejected: 'danger', needs_review: 'violet', cancelled: 'neutral' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DebitBatchPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale) || !UUID.test(id)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const t = await getTranslations('credit');

  const data = await withPageCtx(async (ctx) => {
    if (!can(ctx.perms, 'credit_sales.payment.read')) return null;
    const batch = await getBatch(ctx, id);
    return batch ? { ...batch, canWrite: can(ctx.perms, 'credit_sales.payment.write') } : null;
  });
  if (!data) notFound();
  const { batch, items, canWrite } = data;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(new Date());
  const open = batch.status === 'draft' || batch.status === 'exported';
  const reasonText = (code: string | null) => (code ? (t.has(`debits.reasons.${code}`) ? t(`debits.reasons.${code}`) : code) : '');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link href="/credit/debits" className="text-sm text-muted underline">
          {t('debits.back')}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight" dir="ltr">
            {batch.number}
          </h1>
          <StatusChip tint={batch.status === 'closed' ? 'success' : batch.status === 'cancelled' ? 'neutral' : 'info'}>
            {t(`debits.batch.${batch.status}`)}
          </StatusChip>
          <span className="text-sm text-muted" dir="ltr">
            {batch.periodMonth.slice(0, 7)}
          </span>
        </div>
        <p className="max-w-3xl text-xs text-muted">{t('debits.templateNote')}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <KpiTile label={t('debits.summary.items')} value={String(batch.items)} icon={ListChecks} tint="info" />
        <KpiTile label={t('debits.summary.paid')} value={String(batch.paid)} icon={CheckCircle2} tint="success" />
        <KpiTile label={t('debits.summary.rejected')} value={String(batch.rejected)} icon={XCircle} tint={batch.rejected > 0 ? 'danger' : 'neutral'} />
        <KpiTile label={t('debits.summary.review')} value={String(batch.needsReview)} icon={AlertTriangle} tint={batch.needsReview > 0 ? 'violet' : 'neutral'} />
        <KpiTile label={t('debits.summary.total')} value={formatDzd(batch.totalCents as Cents, loc)} icon={Wallet} tint="neutral" />
      </div>

      <DebitDateProvider defaultDate={today}>
      {canWrite ? (
        <section className="app-panel p-5">
          <BatchToolbar batchId={batch.id} status={batch.status} hasPending={batch.pending > 0} />
        </section>
      ) : null}

      {batch.needsReview > 0 ? (
        <p role="note" className="rounded-2xl bg-tint-violet p-3 text-sm text-tint-violet-fg">
          {t('debits.reviewHint')}
        </p>
      ) : null}

      <section className="app-panel flex flex-col gap-4 p-5">
        <div className="overflow-x-auto rounded-2xl bg-surface-secondary/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('debits.table.reference')}</TableHead>
                <TableHead>{t('debits.table.contract')}</TableHead>
                <TableHead>{t('debits.table.customer')}</TableHead>
                <TableHead>{t('debits.table.account')}</TableHead>
                <TableHead>{t('debits.table.due')}</TableHead>
                <TableHead className="text-end">{t('debits.table.amount')}</TableHead>
                <TableHead>{t('debits.table.status')}</TableHead>
                {open && canWrite ? <TableHead>{t('debits.table.actions')}</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell dir="ltr" className="text-start">{i.reference}</TableCell>
                  <TableCell>
                    <Link href={`/credit/contracts/${i.contractId}`} className="underline">
                      {i.contractReference}
                    </Link>
                  </TableCell>
                  <TableCell>{i.partnerName}</TableCell>
                  <TableCell dir="ltr" className="text-start">{maskCcpAccount(i.ccpAccount)}</TableCell>
                  <TableCell dir="ltr" className="text-start">{i.dueDate}</TableCell>
                  <TableCell className="text-end tabular-nums">{formatDzd(i.amountCents as Cents, loc)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <StatusChip tint={ITEM_TINT[i.status] ?? 'neutral'}>{t(`debits.item.${i.status}`)}</StatusChip>
                      {i.reason ? <span className="text-xs text-muted">{reasonText(i.reason)}</span> : null}
                      {i.settledOn ? (
                        <span className="text-xs text-muted" dir="ltr">
                          {i.settledOn}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  {open && canWrite ? (
                    <TableCell>
                      <ItemActions itemId={i.id} status={i.status} />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      </DebitDateProvider>
    </div>
  );
}
