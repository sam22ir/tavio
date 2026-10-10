import { getTranslations } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import type { NextRequest } from 'next/server';
import { withPageCtx } from '@/core/actions/page-ctx';
import { requirePerm } from '@/core/perms';
import { routing } from '@/i18n/routing';
import { buildAccountingExport, type ExportLabels } from '@/modules/accounting/service/accounting-export';
import { ensureDefaults } from '@/modules/accounting/service/chart';

export const dynamic = 'force-dynamic';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** GET /[locale]/accounting/reports/export?from=YYYY-MM-DD&to=YYYY-MM-DD: ZIP of the accounting reports. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }): Promise<Response> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return new Response('Not found', { status: 404 });
  const from = request.nextUrl.searchParams.get('from') ?? '';
  const to = request.nextUrl.searchParams.get('to') ?? '';
  if (!ISO.test(from) || !ISO.test(to) || to < from) return new Response('Invalid range', { status: 400 });

  const t = await getTranslations({ locale, namespace: 'accounting.export' });
  const labels: ExportLabels = {
    entryDate: t('entryDate'),
    entryNumber: t('entryNumber'),
    journal: t('journal'),
    state: t('state'),
    ref: t('ref'),
    account: t('account'),
    accountName: t('accountName'),
    partner: t('partner'),
    label: t('label'),
    debit: t('debit'),
    credit: t('credit'),
    balance: t('balance'),
    opening: t('opening'),
    closing: t('closing'),
    movement: t('movement'),
    line: t('line'),
    amount: t('amount'),
    section: t('section'),
    bilanActif: t('bilanActif'),
    bilanPassif: t('bilanPassif'),
    tcrProduits: t('tcrProduits'),
    tcrCharges: t('tcrCharges'),
  };

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
