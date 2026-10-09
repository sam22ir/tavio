import { describe, expect, it } from 'vitest';
import { manifest } from '../manifest';
import { buildOpenApiDocument } from '../service/openapi';

describe('platform manifest', () => {
  it('declares module_id-prefixed permissions with allowed verbs', () => {
    for (const perm of manifest.permissions) {
      expect(perm.startsWith('platform.')).toBe(true);
      expect(perm).toMatch(/\.(read|write)$/);
    }
  });

  it('only depends on modules built before this one', () => {
    expect(manifest.depends).toEqual(['contacts', 'products']);
  });

  it('places the settings menu at order 95', () => {
    expect(manifest.menus[0]).toMatchObject({ href: '/settings/platform', order: 95 });
  });
});

describe('openapi document', () => {
  it('lists every public path with its scope', () => {
    const doc = buildOpenApiDocument('https://tavio.example');
    const paths = doc.paths as Record<string, Record<string, { 'x-scope'?: string }>>;
    expect(Object.keys(paths).sort()).toEqual([
      '/api/v1/contacts',
      '/api/v1/invoices',
      '/api/v1/openapi.json',
      '/api/v1/products',
    ]);
    expect(paths['/api/v1/products']?.post?.['x-scope']).toBe('products:write');
  });
});
