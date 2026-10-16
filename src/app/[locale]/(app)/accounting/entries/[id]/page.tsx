import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { formatDzd } from '@/core/money';
import { centsToDecimal } from '@/core/io';
import { ensureDefaults, listAccounts, listJournals } from '@/modules/accounting/service/chart';
import { getEntry } from '@/modules/accounting/service/entries';
import { DraftEntryForm } from '@/modules/accounting/ui/draft-entry-form';
import { ReverseButton } from '@/modules/accounting/ui/reverse-button';
import { Chatter } from '@/modules/chatter/ui/chatter';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/primitives/table';

export default async function EntryDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('accounting');

  const res = await withPageCtx((ctx) => getEntry(ctx, id));
  if (!res.ok) notFound();
  const { entry, journalCode, journalName, lines } = res.value;

  if (entry.state === 'draft') {
    const editor = await withPageCtx(async (ctx) => {
      await ensureDefaults(ctx);
      const accs = await listAccounts(ctx, { page: 1, pageSize: 100, filters: {} });
      return { accounts: accs.rows.filter((a) => !a.archived), journals: await listJournals(ctx), lines: await getEntry(ctx, id) };
    });
    const fullLines = editor.lines.ok ? editor.lines.value.lines : [];
    return (
      <section className="flex flex-col gap-6">
        <h1 className="font-mono text-2xl font-semibold">{t('entries.draftTitle')}</h1>
        <DraftEntryForm
          accounts={editor.accounts.map((a) => ({ code: a.code, name: a.name }))}
          journals={editor.journals.map((j) => ({ code: j.code, name: j.name }))}
          draft={{
            id: entry.id,
            journalCode,
            date: entry.date,
            ref: entry.ref ?? '',
            lines: fullLines.map((l, i) => ({
              key: i + 1,
              accountCode: l.accountCode,
              label: l.label ?? '',
              debit: centsToDecimal(l.debitCents) ?? '',
              credit: centsToDecimal(l.creditCents) ?? '',
            })),
          }}
        />
      </section>
    );
  }
  const fmt = (c: bigint) => formatDzd(c, locale as 'fr' | 'ar' | 'en');
  const totalDebit = lines.reduce((s, l) => s + l.debitCents, BigInt(0));
  const totalCredit = lines.reduce((s, l) => s + l.creditCents, BigInt(0));
  const canReverse = entry.state === 'posted' && !entry.reversedById;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-mono text-2xl font-semibold">{entry.number}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border px-2 py-0.5">{t(`options.state.${entry.state}`)}</span>
            <span>{`${journalCode} · ${journalName}`}</span>
            <span className="tabular-nums">{entry.date}</span>
            {entry.ref ? <span>{entry.ref}</span> : null}
          </div>
        </div>
        {canReverse ? <ReverseButton entryId={entry.id} /> : null}
      </header>

        <section className="app-panel flex flex-col gap-4 p-5">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fields.account')}</TableHead>
                  <TableHead>{t('fields.partner')}</TableHead>
                  <TableHead>{t('fields.label')}</TableHead>
                  <TableHead className="text-end">{t('fields.debit')}</TableHead>
                  <TableHead className="text-end">{t('fields.credit')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono">{`${l.accountCode} · ${l.accountName}`}</TableCell>
                    <TableCell>{l.partnerName ?? '—'}</TableCell>
                    <TableCell>{l.label ?? ''}</TableCell>
                    <TableCell className="text-end tabular-nums">{l.debitCents > BigInt(0) ? fmt(l.debitCents) : ''}</TableCell>
                    <TableCell className="text-end tabular-nums">{l.creditCents > BigInt(0) ? fmt(l.creditCents) : ''}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell colSpan={3}>{t('detail.total')}</TableCell>
                  <TableCell className="text-end tabular-nums">{fmt(totalDebit)}</TableCell>
                  <TableCell className="text-end tabular-nums">{fmt(totalCredit)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>

      <Chatter entity="accounting.journal_entry" recordId={entry.id} />
    </section>
  );
}
