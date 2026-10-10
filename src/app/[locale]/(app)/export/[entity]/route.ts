import { getTranslations } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import type { NextRequest } from 'next/server';
import { withPageCtx } from '@/core/actions/page-ctx';
import type { Ctx } from '@/core/ctx';
import { parseListQuery } from '@/core/entities/list-query';
import type { ListQuery, Row } from '@/core/entities/types';
import { toCsv, toXlsx, type CsvSeparator, type IoRow } from '@/core/io';
import { routing } from '@/i18n/routing';
import { entityIoColumns, isExportableEntity } from '@/ui/views/io-columns';
import { EXPORT_SOURCES, MAX_EXPORT_ROWS, type ExportSource } from '../_lib/sources';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;   // the list services clamp page size to 100
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type FetchOutcome =
  | { kind: 'ok'; rows: Row[] }
  | { kind: 'too_large' }
  | { kind: 'error'; code: string };

/** Walks the filtered list page by page. Refuses before reading anything above the cap. */
async function fetchAll(ctx: Ctx, source: ExportSource, query: ListQuery): Promise<FetchOutcome> {
  const first = await source.list(ctx, { ...query, page: 1, pageSize: PAGE_SIZE });
  if (!first.ok) return { kind: 'error', code: first.error.code };
  if (first.value.total > MAX_EXPORT_ROWS) return { kind: 'too_large' };
  const rows: Row[] = [...first.value.rows];
  const pages = Math.ceil(first.value.total / PAGE_SIZE);
  for (let page = 2; page <= pages; page++) {
    const next = await source.list(ctx, { ...query, page, pageSize: PAGE_SIZE });
    if (!next.ok) return { kind: 'error', code: next.error.code };
    rows.push(...next.value.rows);
  }
  return { kind: 'ok', rows };
}

function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers' }).format(new Date());
}

/** GET /[locale]/export/[entity]?<list params>&format=csv|xlsx&sep=,|; */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string; entity: string }> },
): Promise<Response> {
  const { locale, entity: name } = await params;
  const url = request.nextUrl;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: 'io.export' });

  if (!hasLocale(routing.locales, locale) || !isExportableEntity(name)) {
    return new Response('Not found', { status: 404 });
  }
  const source = EXPORT_SOURCES[name];

  const format = url.searchParams.get('format') === 'xlsx' ? 'xlsx' : url.searchParams.get('format') === 'csv' ? 'csv' : null;
  if (!format) return new Response('Unsupported format', { status: 400 });
  const separator: CsvSeparator = url.searchParams.get('sep') === ';' ? ';' : ',';

  const query = parseListQuery(Object.fromEntries(url.searchParams), source.entity);
  const outcome = await withPageCtx((ctx) => fetchAll(ctx, source, query));

  if (outcome.kind === 'too_large') {
    return new Response(t('too_large', { max: MAX_EXPORT_ROWS }), { status: 422, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  if (outcome.kind === 'error') {
    const message = outcome.code === 'FORBIDDEN' ? t('forbidden') : t('failed');
    return new Response(message, { status: outcome.code === 'FORBIDDEN' ? 403 : 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }

  const columns = entityIoColumns(source.entity, locale as 'fr' | 'ar' | 'en');
  const rows: IoRow[] = outcome.rows;
  const views = await getTranslations('views');
  const date = todayIso();
  const body =
    format === 'xlsx'
      ? toXlsx(rows, columns, { sheetName: source.entity.name, rtl: locale === 'ar' })
      : toCsv(rows, columns, {
          separator,
          booleanText: { true: views('yes'), false: views('no') },
        });
  const filename = `${source.fileSlug}-${date}.${format}`;

  return new Response(new Blob([body.slice().buffer]), {
    status: 200,
    headers: {
      'content-type': format === 'xlsx' ? XLSX_TYPE : 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
