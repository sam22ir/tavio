import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { formatDzd } from '@/core/money';
import { ensureDefaults } from '@/modules/accounting/service/chart';
import { getBookBalance, listStatements, listStatementAccounts } from '@/modules/accounting/service/bank-statements';
import { BankStatementImport } from '@/modules/accounting/ui/bank-statement-import';
import { CashCountForm } from '@/modules/accounting/ui/cash-count-form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/primitives/table';

function todayAlgiers(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export default async function ReconciliationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const today = todayAlgiers();
  const data = await withPageCtx(async (ctx) => {
    await ensureDefaults(ctx);
    const [statements, accounts] = await Promise.all([listStatements(ctx), listStatementAccounts(ctx)]);
    if (!statements.ok) throw new Error(statements.error.code);
    if (!accounts.ok) throw new Error(accounts.error.code);
    const cash = accounts.value.find((a) => a.isCash) ?? null;
    const cashBook = cash ? await getBookBalance(ctx, cash.id, today) : null;
    return { statements: statements.value, accounts: accounts.value, cash, cashBook };
  });
  const t = await getTranslations('accounting.reconciliation');
  const currentLocale = await getLocale();

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('title')}</h1>

      <section id="statements" className="flex flex-col gap-4">
        <BankStatementImport accounts={data.accounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))} />
        <h2 className="font-medium">{t('statementsTitle')}</h2>
        {data.statements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noStatements')}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.name')}</TableHead>
                  <TableHead>{t('columns.account')}</TableHead>
                  <TableHead>{t('columns.period')}</TableHead>
                  <TableHead>{t('columns.closing')}</TableHead>
                  <TableHead>{t('columns.state')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.statements.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Link href={`/${currentLocale}/accounting/reconciliation/${s.id}`} className="hover:underline">{s.name}</Link>
                    </TableCell>
                    <TableCell className="font-mono">{s.accountCode}</TableCell>
                    <TableCell>{`${s.dateFrom} → ${s.dateTo}`}</TableCell>
                    <TableCell className="font-mono">{formatDzd(s.closingBalanceCents, locale as 'fr' | 'ar' | 'en')}</TableCell>
                    <TableCell>{t(`state.${s.state}`)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section id="cash" className="flex flex-col gap-4">
        {data.cash ? (
          <CashCountForm accountId={data.cash.id} bookBalance={(data.cashBook ?? BigInt(0)).toString()} today={today} />
        ) : (
          <p className="text-sm text-muted-foreground">{t('cash.title')}</p>
        )}
      </section>
    </main>
  );
}
