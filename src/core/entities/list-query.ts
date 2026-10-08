import type { EntityDef, ListQuery } from './types';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const FILTER_PREFIX = 'f_';

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function toPositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

/**
 * Parses URL search params into a ListQuery for an entity.
 * Unknown sort fields are dropped, pageSize is clamped to 1..100 (default 25),
 * and `f_<field>=value` becomes a filter only for fields declared `filter: true`.
 */
export function parseListQuery(sp: RawParams, entity: EntityDef): ListQuery {
  const q = first(sp.q)?.trim();
  const page = toPositiveInt(first(sp.page), 1);
  const rawSize = Number.parseInt(first(sp.pageSize) ?? '', 10);
  const pageSize = Number.isFinite(rawSize)
    ? Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize))
    : DEFAULT_PAGE_SIZE;

  const sortable = new Set(entity.fields.map((f) => f.name));
  const rawSort = first(sp.sort);
  const sortField = rawSort && sortable.has(rawSort) ? rawSort : undefined;
  const rawDir = first(sp.dir);

  let sort: string | undefined;
  let dir: 'asc' | 'desc' | undefined;
  if (sortField) {
    sort = sortField;
    dir = rawDir === 'desc' ? 'desc' : 'asc';
  } else if (entity.defaultSort) {
    sort = entity.defaultSort.field;
    dir = entity.defaultSort.dir;
  }

  const filterable = new Set(entity.fields.filter((f) => f.filter).map((f) => f.name));
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(sp)) {
    if (!key.startsWith(FILTER_PREFIX)) continue;
    const name = key.slice(FILTER_PREFIX.length);
    const v = first(value)?.trim();
    if (filterable.has(name) && v) filters[name] = v;
  }

  return {
    ...(q ? { q } : {}),
    page,
    pageSize,
    ...(sort ? { sort, dir } : {}),
    filters,
  };
}

/** Serializes a ListQuery back to URL search params. Defaults are omitted. */
export function toSearchParams(q: ListQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (q.q) params.set('q', q.q);
  if (q.page > 1) params.set('page', String(q.page));
  if (q.pageSize !== DEFAULT_PAGE_SIZE) params.set('pageSize', String(q.pageSize));
  if (q.sort) {
    params.set('sort', q.sort);
    if (q.dir) params.set('dir', q.dir);
  }
  for (const [name, value] of Object.entries(q.filters)) {
    if (value) params.set(`${FILTER_PREFIX}${name}`, value);
  }
  return params;
}
