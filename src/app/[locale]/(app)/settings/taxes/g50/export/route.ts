import { getTranslations } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import type { NextRequest } from 'next/server';
import { withPageCtx } from '@/core/actions/page-ctx';
import { toCsv, toXlsx, type IoColumn, type IoRow } from '@/core/io';
import { listG50Declarations } from '@/modules/l10n_dz/service/g50';
import { routing } from '@/i18n/routing';
import { figureCents } from '../figures';

export const dynamic = 'force-dynamic';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** GET /[locale]/settings/taxes/g50/export?year=2026&format=csv|xlsx. One row per month of the year. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
): Promise<Response> {
  const { locale } = await params;
  const url = request.nextUrl;
  const lang = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: lang, namespace: 'l10n.g50' });

  const year = Number(url.searchParams.get('year'));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return new Response('Invalid year', { status: 400 });
  const format = url.searchParams.get('format') === 'xlsx' ? 'xlsx' : url.searchParams.get('format') === 'csv' ? 'csv' : null;
  if (!format) return new Response('Unsupported format', { status: 400 });

  const declarations = await withPageCtx((ctx) => listG50Declarations(ctx, year));
  const byMonth = new Map(declarations.map((d) => [d.month, d]));
  const rows: IoRow[] = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const d = byMonth.get(month);
    const fig = d ? figureCents(d.figures) : null;
    return {
      period: `${year}-${String(month).padStart(2, '0')}`,
      status: d ? d.state : 'none',
      collected: fig ? fig.collected : null,
      deductible: fig ? fig.deductible : null,
      net: fig ? fig.net : null,
      stamp: fig ? fig.stamp : null,
    };
  });
  const columns: IoColumn[] = [
    { key: 'period', header: t('month'), type: 'text' },
    { key: 'status', header: t('status'), type: 'text' },
    { key: 'collected', header: t('print_collected'), type: 'money' },
    { key: 'deductible', header: t('print_deductible'), type: 'money' },
    { key: 'net', header: t('print_net'), type: 'money' },
    { key: 'stamp', header: t('print_stamp'), type: 'money' },
  ];

  const name = `g50-${year}`;
  if (format === 'xlsx') {
    return new Response(toXlsx(rows, columns, { sheetName: name }) as BodyInit, {
      headers: { 'content-type': XLSX_TYPE, 'content-disposition': `attachment; filename="${name}.xlsx"` },
    });
  }
  return new Response(toCsv(rows, columns) as BodyInit, {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}.csv"` },
  });
}
