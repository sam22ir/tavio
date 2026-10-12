import { hasLocale } from 'next-intl';
import type { NextRequest } from 'next/server';
import { withPageCtx } from '@/core/actions/page-ctx';
import { requirePerm } from '@/core/perms';
import { routing } from '@/i18n/routing';
import { exportBatch } from '@/modules/credit_sales/service/debits';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /[locale]/credit/debits/[id]/export → the debit file (Revora's own CSV template, not the Algérie Poste layout).
 * Needs payment.write: the file lists every customer's account number. Marks a draft batch as exported.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ locale: string; id: string }> }): Promise<Response> {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale) || !UUID.test(id)) return new Response('Not found', { status: 404 });

  const out = await withPageCtx(async (ctx) => {
    const perm = requirePerm(ctx, 'credit_sales.payment.write');
    if (!perm.ok) return { status: 403 as const };
    const result = await exportBatch(ctx, id);
    if (!result.ok) return { status: result.error.code === 'NOT_FOUND' ? (404 as const) : (409 as const) };
    return { status: 200 as const, file: result.value };
  });

  if (out.status !== 200) return new Response(out.status === 403 ? 'Forbidden' : 'Unavailable', { status: out.status });
  return new Response(out.file.csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${out.file.number}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
