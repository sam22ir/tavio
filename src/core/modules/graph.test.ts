import { describe, expect, it } from 'vitest';
import type { ModuleManifest } from './define';
import { blockersToDisable, validateGraph, withDependencies } from './graph';

function mod(id: string, depends: string[] = []): ModuleManifest {
  return { id, name: `${id}.name`, version: '1.0.0', depends, permissions: [], menus: [] };
}

describe('validateGraph', () => {
  it('reports a missing dependency', () => {
    const result = validateGraph([mod('credit_sales', ['contacts'])]);
    expect(result).toEqual({ ok: false, missing: [['credit_sales', 'contacts']], cycles: [] });
  });

  it('reports a 3-node cycle', () => {
    const result = validateGraph([mod('a', ['b']), mod('b', ['c']), mod('c', ['a'])]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual([]);
    expect(result.cycles).toHaveLength(1);
    expect([...result.cycles[0]!].sort()).toEqual(['a', 'b', 'c', 'a'].sort());
    expect(result.cycles[0]!.at(0)).toBe(result.cycles[0]!.at(-1));
  });

  it('returns dependencies before dependents', () => {
    const result = validateGraph([
      mod('credit_sales', ['contacts', 'products']),
      mod('products', ['contacts']),
      mod('contacts'),
    ]);
    expect(result).toEqual({ ok: true, order: ['contacts', 'products', 'credit_sales'] });
  });

  it('accepts an empty module list', () => {
    expect(validateGraph([])).toEqual({ ok: true, order: [] });
  });
});

describe('withDependencies', () => {
  it('returns the requested ids plus their full dependency closure', () => {
    const mods = [
      mod('credit_sales', ['contacts', 'products']),
      mod('products', ['inventory']),
      mod('inventory'),
      mod('contacts'),
      mod('crm'),
    ];
    expect(withDependencies(mods, ['credit_sales'])).toEqual([
      'contacts',
      'credit_sales',
      'inventory',
      'products',
    ]);
  });

  it('deduplicates shared dependencies', () => {
    const mods = [mod('a', ['base']), mod('b', ['base']), mod('base')];
    expect(withDependencies(mods, ['a', 'b'])).toEqual(['a', 'b', 'base']);
  });
});

describe('blockersToDisable', () => {
  it('lists enabled modules that depend directly on the module', () => {
    const mods = [mod('contacts'), mod('products'), mod('credit_sales', ['contacts']), mod('crm', ['contacts'])];
    expect(blockersToDisable(mods, ['contacts', 'credit_sales', 'crm'], 'contacts')).toEqual([
      'credit_sales',
      'crm',
    ]);
  });

  it('ignores disabled dependents', () => {
    const mods = [mod('contacts'), mod('credit_sales', ['contacts'])];
    expect(blockersToDisable(mods, ['contacts'], 'contacts')).toEqual([]);
  });

  it('returns nothing when no enabled module depends on it', () => {
    const mods = [mod('contacts'), mod('products')];
    expect(blockersToDisable(mods, ['contacts', 'products'], 'contacts')).toEqual([]);
  });
});
