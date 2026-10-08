import { describe, expect, it } from 'vitest';
import { parseListQuery, toSearchParams } from './list-query';
import type { EntityDef } from './types';

const entity: EntityDef = {
  name: 'contacts.partner',
  labelField: 'name',
  fields: [
    { name: 'name', type: 'text', label: 'f.name', list: true, search: true },
    { name: 'kind', type: 'select', label: 'f.kind', filter: true, options: [{ value: 'a', label: 'k.a' }] },
    { name: 'secret', type: 'text', label: 'f.secret' },
    { name: 'createdAt', type: 'datetime', label: 'f.created' },
  ],
  defaultSort: { field: 'createdAt', dir: 'desc' },
};

describe('parseListQuery', () => {
  it('uses defaults for an empty query', () => {
    const q = parseListQuery({}, entity);
    expect(q.page).toBe(1);
    expect(q.pageSize).toBe(25);
    expect(q.filters).toEqual({});
    expect(q.sort).toBe('createdAt');
    expect(q.dir).toBe('desc');
    expect(q.q).toBeUndefined();
  });

  it('drops unknown sort fields and keeps known ones', () => {
    const bad = parseListQuery({ sort: 'nope', dir: 'desc' }, entity);
    expect(bad.sort).toBe('createdAt');
    const good = parseListQuery({ sort: 'name', dir: 'desc' }, entity);
    expect(good.sort).toBe('name');
    expect(good.dir).toBe('desc');
  });

  it('clamps pageSize to 1..100 and falls back to 25 when invalid', () => {
    expect(parseListQuery({ pageSize: '500' }, entity).pageSize).toBe(100);
    expect(parseListQuery({ pageSize: '0' }, entity).pageSize).toBe(1);
    expect(parseListQuery({ pageSize: 'abc' }, entity).pageSize).toBe(25);
  });

  it('parses page and trims q', () => {
    const q = parseListQuery({ page: '3', q: '  ali  ' }, entity);
    expect(q.page).toBe(3);
    expect(q.q).toBe('ali');
  });

  it('only keeps f_ filters for fields marked filter', () => {
    const q = parseListQuery({ f_kind: 'a', f_secret: 'x', f_unknown: 'y', f_kind2: '' }, entity);
    expect(q.filters).toEqual({ kind: 'a' });
  });

  it('takes the first value when a param repeats', () => {
    expect(parseListQuery({ q: ['one', 'two'] }, entity).q).toBe('one');
  });
});

describe('toSearchParams', () => {
  it('omits default values and round-trips the query', () => {
    const q = parseListQuery({ q: 'ali', page: '2', sort: 'name', dir: 'asc', f_kind: 'a' }, entity);
    const params = toSearchParams(q);
    expect(params.get('q')).toBe('ali');
    expect(params.get('page')).toBe('2');
    expect(params.get('sort')).toBe('name');
    expect(params.get('dir')).toBe('asc');
    expect(params.get('f_kind')).toBe('a');
    expect(params.has('pageSize')).toBe(false);
    expect(parseListQuery(Object.fromEntries(params), entity)).toEqual(q);
  });

  it('returns empty params for the default query without a default sort', () => {
    const params = toSearchParams({ page: 1, pageSize: 25, filters: {} });
    expect(params.toString()).toBe('');
  });
});
