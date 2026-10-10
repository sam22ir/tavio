import type { Ctx } from '@/core/ctx';

// Smart-button registry. Each module declares its related-record links once, with a count and a
// list href pre-filtered to the record. The permission gates both the count and the link.

export interface RelationDef {
  /** Unique id, e.g. 'contacts.partner->sales.order'. */
  id: string;
  /** Source entity name, e.g. 'contacts.partner'. */
  source: string;
  /** i18n key for the label, under the `relations` namespace. */
  labelKey: string;
  /** lucide-react icon name. */
  icon: string;
  /** Permission needed to see this relation. */
  perm: string;
  /** Counts the related rows for the record. Runs inside the page's tenant transaction. */
  count: (ctx: Ctx, id: string) => Promise<number>;
  /** Builds the list URL pre-filtered to the record. */
  href: (locale: string, id: string) => string;
}

export interface RelationCount {
  relation: RelationDef;
  count: number;
}

export interface RelationRegistry {
  register: (def: RelationDef) => void;
  relationsFor: (source: string, perms: ReadonlySet<string>) => RelationDef[];
  countRelations: (ctx: Ctx, source: string, id: string) => Promise<RelationCount[]>;
}

export function createRelationRegistry(): RelationRegistry {
  const byId = new Map<string, RelationDef>();

  function register(def: RelationDef): void {
    if (byId.has(def.id)) throw new Error(`Relation "${def.id}" is already registered`);
    byId.set(def.id, def);
  }

  function relationsFor(source: string, perms: ReadonlySet<string>): RelationDef[] {
    return [...byId.values()].filter((r) => r.source === source && perms.has(r.perm));
  }

  // All counts for one record run in parallel, inside the caller's single transaction.
  async function countRelations(ctx: Ctx, source: string, id: string): Promise<RelationCount[]> {
    const defs = relationsFor(source, ctx.perms);
    const counts = await Promise.all(defs.map((d) => d.count(ctx, id)));
    return defs.map((relation, i) => ({ relation, count: counts[i] ?? 0 }));
  }

  return { register, relationsFor, countRelations };
}

export const relations: RelationRegistry = createRelationRegistry();
