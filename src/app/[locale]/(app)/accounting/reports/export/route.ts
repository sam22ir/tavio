import { getTranslations } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import type { NextRequest } from 'next/server';
import { withPageCtx } from '@/core/actions/page-ctx';
import { requirePerm } from '@/core/perms';
import { toCsv, toXlsx, type CsvSeparator } from '@/core/io';
import { routing } from '@/i18n/routing';
import {
  buildAccountingExport,
  REPORT_KINDS,
  reportTable,
  type ExportLabels,
  type ReportKind,
} from '@/modules/accounting/service/accounting-export';
import { ensureDefaults } from '@/modules/accounting/service/chart';

export const dynamic = 'force-dynamic';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * GET /[locale]/accounting/reports/export?from&to
 *   → ZIP of all reports (XLSX).
 * GET /[locale]/accounting/reports/export?report=trial|ledger|bilan|tcr|aging|journal&from&to&account&format=csv|xlsx&sep=,|;
 *   → one report as CSV or XLSX.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }): Promise<Response> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return new Response('Not found', { status: 404 });
  const sp = request.nextUrl.searchParams;
  const from = sp.get('from') ?? '';
  const to = sp.get('to') ?? '';
  if (!ISO.test(from) || !ISO.test(to) || to < from) return new Response('Invalid range', { status: 400 });

  const t = await getTranslations({ locale, namespace: 'accounting.export' });
  const ta = await getTranslations({ locale, namespace: 'accounting.reports.aging' });
  const ts = await getTranslations({ locale, namespace: 'accounting.statements' });
  const labels: ExportLabels = {
    entryDate: t('entryDate'), entryNumber: t('entryNumber'), journal: t('journal'), state: t('state'), ref: t('ref'),
    account: t('account'), accountName: t('accountName'), partner: t('partner'), label: t('label'), debit: t('debit'),
    credit: t('credit'), balance: t('balance'), opening: t('opening'), closing: t('closing'), movement: t('movement'),
    line: t('line'), amount: t('amount'), section: t('section'), bilanActif: t('bilanActif'), bilanPassif: t('bilanPassif'),
    tcrProduits: t('tcrProduits'), tcrCharges: t('tcrCharges'),
    bilanLine: (key) => ts(`bilan.${key}`),
    tcrLine: (key) => ts(`tcr.${key}`),
    agingBuckets: { '0-30': ta('0-30'), '31-60': ta('31-60'), '61-90': ta('61-90'), '90+': ta('90+') },
  };

  const report = sp.get('report');
  if (report !== null) {
    if (!(REPORT_KINDS as readonly string[]).includes(report)) return new Response('Unsupported report', { status: 400 });
    const kind = report as ReportKind;
    const account = (sp.get('account') ?? '').trim().slice(0, 12) || null;
    if (kind === 'ledger' && !account) return new Response('Account required', { status: 400 });
    const format = sp.get('format') === 'csv' ? 'csv' : 'xlsx';
    const sep: CsvSeparator = sp.get('sep') === ';' ? ';' : ',';

    const table = await withPageCtx(async (ctx) => {
      const perm = requirePerm(ctx, 'accounting.report.read');
      if (!perm.ok) return null;
      await ensureDefaults(ctx);
      return reportTable(ctx, kind, { from, to }, labels, account);
    });
    if (!table) return new Response('Forbidden', { status: 403 });

    const name = `${kind}-${to}`;
    if (format === 'csv') {
      return new Response(toCsv(table.rows, table.columns, { separator: sep }) as BodyInit, {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.csv"`, 'Cache-Control': 'no-store' },
      });
    }
    const bytes = toXlsx(table.rows, table.columns, { sheetName: kind, rtl: locale === 'ar', now: new Date() });
    return new Response(bytes as BodyInit, {
      headers: { 'Content-Type': XLSX_TYPE, 'Content-Disposition': `attachment; filename="${name}.xlsx"`, 'Cache-Control': 'no-store' },
    });
  }

  const file = await withPageCtx(async (ctx) => {
    const perm = requirePerm(ctx, 'accounting.report.read');
    if (!perm.ok) return null;
    await ensureDefaults(ctx);
    return buildAccountingExport(ctx, { from, to }, labels, locale === 'ar');
  });
  if (!file) return new Response('Forbidden', { status: 403 });
  return new Response(file.bytes as BodyInit, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
