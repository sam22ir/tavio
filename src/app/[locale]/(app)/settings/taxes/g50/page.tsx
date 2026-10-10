import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Locale } from '@/core/ctx';
import { formatDzd } from '@/core/money';
import { withTenant } from '@/core/db/tenant';
import { listG50Declarations } from '@/modules/l10n_dz/service/g50';
import { routing } from '@/i18n/routing';
import { loadShell } from '@/ui/shell/load-shell';
import { Badge } from '@/ui/primitives/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/primitives/table';
import { G50Actions } from './g50-actions';
import { figureCents } from './figures';

export default async function G50Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const now = new Date().getUTCFullYear();
  const parsed = Number((await searchParams).year);
  const year = Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : now;

  const shell = await loadShell(locale as Locale);
  const t = await getTranslations('l10n');
  const rows = await withTenant(shell.tenant, (ctx) => listG50Declarations(ctx, year));
  const byMonth = new Map(rows.map((r) => [r.month, r]));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t('g50.title')}</h1>
        <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {t('g50.draft_banner')}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link className="underline underline-offset-4" href={`/settings/taxes/g50?year=${year - 1}`}>{t('g50.prev_year')}</Link>
          <span className="font-medium tabular-nums">{year}</span>
          <Link className="underline underline-offset-4" href={`/settings/taxes/g50?year=${year + 1}`}>{t('g50.next_year')}</Link>
          <a className="ms-auto min-h-11 underline underline-offset-4 md:min-h-0" href={`/settings/taxes/g50/export?year=${year}&format=csv`}>
            {t('g50.export_csv')}
          </a>
          <a className="min-h-11 underline underline-offset-4 md:min-h-0" href={`/settings/taxes/g50/export?year=${year}&format=xlsx`}>
            {t('g50.export_xlsx')}
          </a>
        </div>
      </header>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('g50.month')}</TableHead>
              <TableHead>{t('g50.status')}</TableHead>
              <TableHead className="text-end">{t('g50.collected')}</TableHead>
              <TableHead className="text-end">{t('g50.deductible')}</TableHead>
              <TableHead className="text-end">{t('g50.net')}</TableHead>
              <TableHead className="text-end">{t('g50.stamp')}</TableHead>
              <TableHead>{t('g50.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
              const row = byMonth.get(month);
              const state = row ? (row.state as 'draft' | 'validated') : 'none';
              const fig = row ? figureCents(row.figures) : null;
              return (
                <TableRow key={month}>
                  <TableCell>{String(month).padStart(2, '0')}/{year}</TableCell>
                  <TableCell>
                    <Badge variant={state === 'validated' ? 'default' : 'secondary'}>
                      {state === 'none' ? t('g50.status_none') : state === 'draft' ? t('g50.status_draft') : t('g50.status_validated')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{fig ? formatDzd(fig.collected, locale as Locale) : '—'}</TableCell>
                  <TableCell className="text-end tabular-nums">{fig ? formatDzd(fig.deductible, locale as Locale) : '—'}</TableCell>
                  <TableCell className="text-end tabular-nums">{fig ? formatDzd(fig.net, locale as Locale) : '—'}</TableCell>
                  <TableCell className="text-end tabular-nums">{fig ? formatDzd(fig.stamp, locale as Locale) : '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <G50Actions year={year} month={month} state={state} />
                      {row ? (
                        <Link className="inline-flex min-h-11 items-center underline underline-offset-4 md:min-h-9" href={`/settings/taxes/g50/${year}/${month}/print`}>
                          {t('g50.print')}
                        </Link>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
