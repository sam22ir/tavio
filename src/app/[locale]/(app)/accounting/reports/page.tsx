import Link from 'next/link';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { withPageCtx } from '@/core/actions/page-ctx';
import { formatDzd } from '@/core/money';
import { ensureDefaults } from '@/modules/accounting/service/chart';
import { g50Draft, partnerBalances } from '@/modules/accounting/service/reports';
import { partnerAging, statementsWithComparison, trialBalanceWithOpening, grandLivreWithOpening, AGING_BUCKETS } from '@/modules/accounting/service/statements';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import { Button } from '@/ui/primitives/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/primitives/table';

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const REPORTS = ['trial', 'ledger', 'partners', 'bilan', 'tcr', 'aging', 'g50'] as const;
type ReportKey = (typeof REPORTS)[number];

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const sp = await searchParams;
  const report: ReportKey = (REPORTS as readonly string[]).includes(one(sp.report)) ? (one(sp.report) as ReportKey) : 'trial';
  const from = ISO.test(one(sp.from)) ? one(sp.from) : undefined;
  const to = ISO.test(one(sp.to)) ? one(sp.to) : undefined;
  const account = one(sp.account).trim().slice(0, 12);
  const year = Number(one(sp.year)) || new Date().getUTCFullYear();
  const month = Math.min(12, Math.max(1, Number(one(sp.month)) || new Date().getUTCMonth() + 1));

  const t = await getTranslations('accounting');
  const currentLocale = await getLocale();
  const fmt = (c: bigint) => formatDzd(c, locale as 'fr' | 'ar' | 'en');
  const base = `/${currentLocale}/accounting/reports`;

  const asOf = to ?? new Date().toISOString().slice(0, 10);
  const yearStart = from ?? `${asOf.slice(0, 4)}-01-01`;
  const shiftYear = (d: string, years: number) => `${String(Number(d.slice(0, 4)) + years)}${d.slice(4)}`;
  const comparison = { start: shiftYear(yearStart, -1), end: shiftYear(asOf, -1) };

  const data = await withPageCtx(async (ctx) => {
    await ensureDefaults(ctx);
    if (report === 'trial') return { kind: 'trial' as const, value: await trialBalanceWithOpening(ctx, { from, to }) };
    if (report === 'ledger') {
      if (!account) return { kind: 'ledger' as const, value: null };
      const res = await grandLivreWithOpening(ctx, account, { from, to });
      return { kind: 'ledger' as const, value: res.ok ? res.value : null };
    }
    if (report === 'bilan' || report === 'tcr') {
      const stmts = await statementsWithComparison(ctx, { start: yearStart, end: asOf }, comparison);
      return { kind: report, value: stmts };
    }
    if (report === 'aging') return { kind: 'aging' as const, value: await partnerAging(ctx, asOf, '411') };
    if (report === 'partners') {
      const acc = account === '401' ? '401' : '411';
      return { kind: 'partners' as const, value: await partnerBalances(ctx, acc, { from, to }) };
    }
    return { kind: 'g50' as const, value: await g50Draft(ctx, year, month) };
  });

  const exportHref = `/${currentLocale}/accounting/reports/export?from=${yearStart}&to=${asOf}`;
  const singleKind = ({ trial: 'balance', ledger: 'ledger', bilan: 'bilan', tcr: 'tcr', aging: 'aging' } as Record<string, string>)[report];
  const singleHref = singleKind
    ? `/${currentLocale}/accounting/reports/export?report=${singleKind}&from=${yearStart}&to=${asOf}${singleKind === 'ledger' && account ? `&account=${account}` : ''}`
    : null;

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold">{t('reports.title')}</h1>
      <a href={exportHref} className="w-fit rounded-md border px-3 py-1.5 text-sm">{t('reports.export')}</a>
      {singleHref ? (
        <div className="flex flex-wrap gap-2 text-sm">
          <a href={`${singleHref}&format=xlsx`} className="rounded-md border px-3 py-1.5">{t('reports.exportXlsx')}</a>
          <a href={`${singleHref}&format=csv&sep=;`} className="rounded-md border px-3 py-1.5">{t('reports.exportCsv')}</a>
        </div>
      ) : null}
      <nav className="flex flex-wrap gap-2">
        {REPORTS.map((r) => (
          <Link key={r} href={`${base}?report=${r}`} className={`rounded-md border px-3 py-1.5 text-sm ${r === report ? 'bg-muted font-medium' : ''}`}>
            {t(`reports.tabs.${r}`)}
          </Link>
        ))}
      </nav>

      <form method="get" className="grid gap-3 sm:grid-cols-5">
        <input type="hidden" name="report" value={report} />
        {report === 'g50' ? (
          <>
            <div className="flex flex-col gap-1">
              <Label htmlFor="year">{t('reports.year')}</Label>
              <Input id="year" name="year" inputMode="numeric" defaultValue={year} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="month">{t('reports.month')}</Label>
              <Input id="month" name="month" inputMode="numeric" defaultValue={month} />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <Label htmlFor="from">{t('reports.from')}</Label>
              <Input id="from" name="from" type="date" defaultValue={from ?? ''} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="to">{t('reports.to')}</Label>
              <Input id="to" name="to" type="date" defaultValue={to ?? ''} />
            </div>
          </>
        )}
        {report === 'ledger' || report === 'partners' ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="account">{t('fields.account')}</Label>
            <Input id="account" name="account" defaultValue={account} />
          </div>
        ) : null}
        <div className="flex items-end">
          <Button type="submit">{t('reports.apply')}</Button>
        </div>
      </form>

      {data.kind === 'trial' ? (
        <div className="flex flex-col gap-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fields.code')}</TableHead>
                  <TableHead>{t('fields.name')}</TableHead>
                  <TableHead className="text-end">{t('fields.debit')}</TableHead>
                  <TableHead className="text-end">{t('fields.credit')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.value.rows.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="font-mono">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-end tabular-nums">{fmt(r.debitCents)}</TableCell>
                    <TableCell className="text-end tabular-nums">{fmt(r.creditCents)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold">
                  <TableCell colSpan={2}>{t('reports.totals')}</TableCell>
                  <TableCell className="text-end tabular-nums">{fmt(data.value.totalDebitCents)}</TableCell>
                  <TableCell className="text-end tabular-nums">{fmt(data.value.totalCreditCents)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p className="text-sm">{data.value.balanced ? t('reports.balanced') : t('reports.notBalanced')}</p>
        </div>
      ) : null}

      {data.kind === 'ledger' ? (
        data.value ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fields.date')}</TableHead>
                  <TableHead>{t('fields.number')}</TableHead>
                  <TableHead>{t('fields.label')}</TableHead>
                  <TableHead className="text-end">{t('fields.debit')}</TableHead>
                  <TableHead className="text-end">{t('fields.credit')}</TableHead>
                  <TableHead className="text-end">{t('reports.balance')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.value.rows.map((r, i) => (
                  <TableRow key={`${r.number}-${i}`}>
                    <TableCell className="tabular-nums">{r.date}</TableCell>
                    <TableCell className="font-mono">{r.number}</TableCell>
                    <TableCell>{r.label ?? r.ref ?? ''}</TableCell>
                    <TableCell className="text-end tabular-nums">{fmt(r.debitCents)}</TableCell>
                    <TableCell className="text-end tabular-nums">{fmt(r.creditCents)}</TableCell>
                    <TableCell className="text-end tabular-nums">{fmt(r.balanceCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('reports.pickAccount')}</p>
        )
      ) : null}

      {data.kind === 'partners' ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('fields.partner')}</TableHead>
                <TableHead className="text-end">{t('fields.debit')}</TableHead>
                <TableHead className="text-end">{t('fields.credit')}</TableHead>
                <TableHead className="text-end">{t('reports.balance')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.value.map((r) => (
                <TableRow key={r.partnerId ?? r.partnerName}>
                  <TableCell>{r.partnerName}</TableCell>
                  <TableCell className="text-end tabular-nums">{fmt(r.debitCents)}</TableCell>
                  <TableCell className="text-end tabular-nums">{fmt(r.creditCents)}</TableCell>
                  <TableCell className="text-end tabular-nums">{fmt(r.balanceCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {data.kind === 'g50' ? (
        <div className="flex flex-col gap-3 rounded-md border p-4">
          <p className="text-sm text-muted-foreground">{t('reports.g50.period', { from: data.value.period.from, to: data.value.period.to })}</p>
          <dl className="grid gap-2 sm:grid-cols-3">
            <div><dt className="text-sm">{t('reports.g50.collected')}</dt><dd className="tabular-nums">{fmt(data.value.collectedCents)}</dd></div>
            <div><dt className="text-sm">{t('reports.g50.deductible')}</dt><dd className="tabular-nums">{fmt(data.value.deductibleCents)}</dd></div>
            <div><dt className="text-sm">{t('reports.g50.net')}</dt><dd className="font-semibold tabular-nums">{fmt(data.value.netDueCents)}</dd></div>
          </dl>
          <p role="note" className="text-sm">{t('reports.g50.verify')}</p>
        </div>
      ) : null}
      {data.kind === 'bilan' ? (
        <div className="grid gap-6 md:grid-cols-2">
          {(['actif', 'passif'] as const).map((side) => (
            <div key={side} className="overflow-x-auto">
              <h2 className="mb-2 font-medium">{t(`reports.bilan.${side}`)}</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('fields.name')}</TableHead>
                    <TableHead className="text-end">{t('reports.bilan.current')}</TableHead>
                    <TableHead className="text-end">{t('reports.bilan.previous')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(side === 'actif' ? data.value.bilan.actif : data.value.bilan.passif).map((l, i) => (
                    <TableRow key={l.key}>
                      <TableCell>{l.label}</TableCell>
                      <TableCell className="text-end tabular-nums">{fmt(l.amountCents)}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        {data.value.previous ? fmt((side === 'actif' ? data.value.previous.bilan.actif : data.value.previous.bilan.passif)[i]!.amountCents) : ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
          <p className="text-sm md:col-span-2">
            {data.value.bilan.balanced ? t('reports.bilan.balanced') : t('reports.bilan.notBalanced')}
          </p>
        </div>
      ) : null}

      {data.kind === 'tcr' ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('fields.name')}</TableHead>
                <TableHead className="text-end">{t('reports.bilan.current')}</TableHead>
                <TableHead className="text-end">{t('reports.bilan.previous')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...data.value.tcr.produits, ...data.value.tcr.charges].map((l, i) => {
                const prevList = data.value.previous ? [...data.value.previous.tcr.produits, ...data.value.previous.tcr.charges] : [];
                return (
                  <TableRow key={l.key}>
                    <TableCell>{l.label}</TableCell>
                    <TableCell className="text-end tabular-nums">{fmt(l.amountCents)}</TableCell>
                    <TableCell className="text-end tabular-nums">{prevList[i] ? fmt(prevList[i]!.amountCents) : ''}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="font-semibold">
                <TableCell>{t('reports.tcr.result')}</TableCell>
                <TableCell className="text-end tabular-nums">{fmt(data.value.tcr.resultCents)}</TableCell>
                <TableCell className="text-end tabular-nums">{data.value.previous ? fmt(data.value.previous.tcr.resultCents) : ''}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : null}

      {data.kind === 'aging' ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('fields.partner')}</TableHead>
                {AGING_BUCKETS.map((b) => (
                  <TableHead key={b} className="text-end">{t(`reports.aging.${b}`)}</TableHead>
                ))}
                <TableHead className="text-end">{t('reports.totals')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.value.map((r) => (
                <TableRow key={r.partnerId ?? r.partnerName}>
                  <TableCell>{r.partnerName}</TableCell>
                  {AGING_BUCKETS.map((b) => (
                    <TableCell key={b} className="text-end tabular-nums">{fmt(r.buckets[b])}</TableCell>
                  ))}
                  <TableCell className="text-end tabular-nums">{fmt(r.totalCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

    </main>
  );
}
