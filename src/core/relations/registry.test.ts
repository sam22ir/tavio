import { describe, expect, it } from 'vitest';
import type { Ctx } from '@/core/ctx';
import { createRelationRegistry, type RelationDef } from './registry';

const ctx = {} as Ctx;

function def(overrides: Partial<RelationDef> & { id: string }): RelationDef {
  return {
    source: 'contacts.partner',
    labelKey: 'relations.test',
    icon: 'FileText',
    perm: 'sales.order.read',
    count: async () => 1,
    href: (locale, id) => `/${locale}/x?f_partnerId=${id}`,
    ...overrides,
  };
}

describe('relation registry', () => {
  it('registers relations and returns them for the source', () => {
    const reg = createRelationRegistry();
    reg.register(def({ id: 'a' }));
    reg.register(def({ id: 'b', source: 'crm.lead' }));
    const found = reg.relationsFor('contacts.partner', new Set(['sales.order.read']));
    expect(found.map((r) => r.id)).toEqual(['a']);
  });

  it('rejects a duplicate id', () => {
    const reg = createRelationRegistry();
    reg.register(def({ id: 'a' }));
    expect(() => reg.register(def({ id: 'a' }))).toThrow(/already registered/);
  });

  it('hides relations the user has no permission for', () => {
    const reg = createRelationRegistry();
    reg.register(def({ id: 'sales', perm: 'sales.order.read' }));
    reg.register(def({ id: 'tickets', perm: 'helpdesk.ticket.read' }));
    expect(reg.relationsFor('contacts.partner', new Set()).length).toBe(0);
    expect(reg.relationsFor('contacts.partner', new Set(['helpdesk.ticket.read'])).map((r) => r.id)).toEqual([
      'tickets',
    ]);
  });

  it('counts only visible relations, in registration order', async () => {
    const reg = createRelationRegistry();
    reg.register(def({ id: 'sales', count: async () => 3 }));
    reg.register(def({ id: 'secret', perm: 'hr.leave.read', count: async () => 9 }));
    reg.register(def({ id: 'tickets', perm: 'helpdesk.ticket.read', count: async () => 0 }));
    const rows = await reg.countRelations(
      { ...ctx, perms: new Set(['sales.order.read', 'helpdesk.ticket.read']) } as Ctx,
      'contacts.partner',
      'p1',
    );
    expect(rows.map((r) => [r.relation.id, r.count])).toEqual([
      ['sales', 3],
      ['tickets', 0],
    ]);
  });
});
