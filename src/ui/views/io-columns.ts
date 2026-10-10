import type { EntityDef, FieldDef } from '@/core/entities/types';
import type { IoCellType, IoColumn } from '@/core/io';
import { translateKey } from './format';

type Locale = 'fr' | 'ar' | 'en';

/**
 * Entities whose lists can be exported. DataList shows the Exporter button only for these,
 * and the export route has a source for each one (typed in export/_lib/sources.ts).
 */
export const EXPORTABLE_ENTITY_NAMES = ['contacts.partner', 'products.product', 'crm.lead'] as const;
export type ExportableEntityName = (typeof EXPORTABLE_ENTITY_NAMES)[number];

export function isExportableEntity(name: string): name is ExportableEntityName {
  return (EXPORTABLE_ENTITY_NAMES as readonly string[]).includes(name);
}

function cellTypeFor(field: FieldDef): IoCellType {
  switch (field.type) {
    case 'money': return 'money';
    case 'number': return 'number';
    case 'date': return 'date';
    case 'datetime': return 'datetime';
    case 'boolean': return 'boolean';
    default: return 'text';
  }
}

/** Export columns for an entity: every field, with its localized header. Relations export their label. */
export function entityIoColumns(entity: EntityDef, locale: Locale): IoColumn[] {
  return entity.fields.map((field) => ({
    key: field.type === 'relation' ? `${field.name}Label` : field.name,
    header: translateKey(field.label, locale),
    type: cellTypeFor(field),
  }));
}
