import { hasLocale } from 'next-intl';
import type { NextRequest } from 'next/server';
import { toCsv, type CsvSeparator } from '@/core/io';
import { routing } from '@/i18n/routing';
import { IMPORT_TARGETS, importTemplateRows, isImportEntity } from '../../_lib/targets';

export const dynamic = 'force-dynamic';

/** GET /[locale]/import/[entity]/template?sep=;|, : CSV with the French header row and one example row. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string; entity: string }> },
): Promise<Response> {
  const { locale, entity } = await params;
  if (!hasLocale(routing.locales, locale) || !isImportEntity(entity)) {
    return new Response('Not found', { status: 404 });
  }
  const separator: CsvSeparator = request.nextUrl.searchParams.get('sep') === ',' ? ',' : ';';
  const { header, example } = importTemplateRows(IMPORT_TARGETS[entity]);
  const columns = header.map((text, i) => ({ key: `c${i}`, header: text }));
  const record = Object.fromEntries(example.map((value, i) => [`c${i}`, value]));
  const csv = toCsv([record], columns, { separator });
  return new Response(new Blob([csv.slice().buffer]), {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="modele-${entity}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
