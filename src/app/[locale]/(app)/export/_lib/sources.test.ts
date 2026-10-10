import { describe, expect, it } from 'vitest';
import { EXPORTABLE_ENTITY_NAMES } from '@/ui/views/io-columns';
import { EXPORT_SOURCES } from './sources';

describe('export sources', () => {
  it.each(EXPORTABLE_ENTITY_NAMES)('%s has a read permission, a list function and matching entity', (name) => {
    const source = EXPORT_SOURCES[name];
    expect(source.readPerm).toMatch(/^[a-z_]+\.[a-z_]+\.read$/);
    expect(typeof source.list).toBe('function');
    expect(source.entity.name).toBe(name);
    expect(source.fileSlug).toMatch(/^[a-z-]+$/);
  });

  it('has a source for every exportable entity and nothing else', () => {
    expect(Object.keys(EXPORT_SOURCES).sort()).toEqual([...EXPORTABLE_ENTITY_NAMES].sort());
  });
});
