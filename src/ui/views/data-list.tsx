import type { ReactNode } from 'react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { EntityDef, FieldDef, ListQuery, ListResult, Row } from '@/core/entities/types';
import { toSearchParams } from '@/core/entities/list-query';
import { cn } from '@/ui/lib/cn';
import { SearchBar } from './search-bar';
import { Pagination } from './pagination';
import { formatCell } from './format';
import { isExportableEntity } from './io-columns';
import { buttonVariants } from '@/ui/primitives/button';

interface DataListProps {
  entity: EntityDef;
  result: ListResult;
  query: ListQuery;
  basePath: string;
  rowHref?: (r: Row) => string;
  actions?: ReactNode;
}

type Locale = 'fr' | 'ar' | 'en';

function cellValue(field: FieldDef, row: Row): unknown {
  return field.type === 'relation' ? row[`${field.name}Label`] : row[field.name];
}

function sortHref(basePath: string, query: ListQuery, field: string): string {
  const nextDir = query.sort === field && query.dir === 'asc' ? 'desc' : 'asc';
  const qs = toSearchParams({ ...query, page: 1, sort: field, dir: nextDir }).toString();
  return `${basePath}?${qs}`;
}

export async function DataList({ entity, result, query, basePath, rowHref, actions }: DataListProps) {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;

  const listFields = entity.fields.filter((f) => f.list);
  const labelField = entity.fields.find((f) => f.name === entity.labelField);
  const secondary = listFields.filter((f) => f.name !== entity.labelField).slice(0, 2);
  const isEmpty = result.rows.length === 0;
  const exportable = isExportableEntity(entity.name);

  const titleFor = (row: Row) => {
    const value = labelField ? formatCell(labelField, cellValue(labelField, row), locale) : String(row.id);
    return rowHref ? (
      <Link href={rowHref(row)} className="font-medium text-foreground hover:underline">
        {value}
      </Link>
    ) : (
      <span className="font-medium">{value}</span>
    );
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar entity={entity} query={query} />
        {actions || exportable ? (
          <div className="flex items-center gap-2">
            {actions}
            {exportable ? <ExportMenu entityName={entity.name} query={query} locale={locale} /> : null}
          </div>
        ) : null}
      </div>

      {isEmpty ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t('views.empty')}
        </p>
      ) : (
        <>
          {/* Desktop: table with sortable headers */}
          <div className="hidden overflow-x-auto rounded-md border md:block">
            <table className="w-full text-sm">
              <thead className="bg-default/50 text-start">
                <tr>
                  {listFields.map((field) => {
                    const active = query.sort === field.name;
                    return (
                      <th key={field.name} scope="col" className="px-3 py-2 text-start font-medium">
                        <Link
                          href={sortHref(basePath, query, field.name)}
                          aria-sort={active ? (query.dir === 'desc' ? 'descending' : 'ascending') : undefined}
                          className={cn('hover:underline', active && 'text-foreground')}
                        >
                          {t(field.label)}
                          {active ? (query.dir === 'desc' ? ' ↓' : ' ↑') : null}
                        </Link>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id} className="border-t hover:bg-default/30">
                    {listFields.map((field, i) => (
                      <td key={field.name} className="px-3 py-2 text-start tabular-nums">
                        {i === 0 && rowHref ? (
                          <Link href={rowHref(row)} className="hover:underline">
                            {formatCell(field, cellValue(field, row), locale)}
                          </Link>
                        ) : (
                          formatCell(field, cellValue(field, row), locale)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {result.rows.map((row) => (
              <li key={row.id} className="rounded-md border p-4">
                <div className="text-base">{titleFor(row)}</div>
                {secondary.length > 0 && (
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                    {secondary.map((field) => (
                      <div key={field.name} className="contents">
                        <dt className="text-muted-foreground">{t(field.label)}</dt>
                        <dd className="text-end tabular-nums">
                          {formatCell(field, cellValue(field, row), locale)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <Pagination basePath={basePath} query={query} total={result.total} />
    </section>
  );
}

/** Export dropdown. Plain links, so it works without client JS. Keeps the current filters, search and sort. */
async function ExportMenu({ entityName, query, locale }: { entityName: string; query: ListQuery; locale: Locale }) {
  const t = await getTranslations('io.export');
  const base = `/${locale}/export/${entityName}`;
  const qs = toSearchParams(query).toString();
  const href = (extra: string) => `${base}?${qs ? `${qs}&` : ''}${extra}`;
  const items = [
    { href: href('format=csv&sep=,'), label: t('csv') },
    { href: href('format=csv&sep=;'), label: t('csv_semicolon') },
    { href: href('format=xlsx'), label: t('xlsx') },
  ];
  return (
    <details className="relative">
      <summary className={cn(buttonVariants({ variant: 'outline' }), 'cursor-pointer list-none')}>{t('button')}</summary>
      <ul className="absolute end-0 z-10 mt-1 min-w-56 rounded-md border bg-background p-1 shadow-md">
        {items.map((item) => (
          <li key={item.label}>
            <a href={item.href} className="block rounded-sm px-3 py-2 text-sm hover:bg-default">
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
