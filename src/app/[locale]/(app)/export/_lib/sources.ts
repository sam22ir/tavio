import type { Ctx } from '@/core/ctx';
import type { EntityDef, ListQuery, ListResult, Row } from '@/core/entities/types';
import type { Result } from '@/core/result';
import { leadEntity } from '@/modules/crm/entities';
import { listLeads } from '@/modules/crm/service/leads';
import { partnerEntity } from '@/modules/contacts/entities';
import { listPartners } from '@/modules/contacts/service/partners';
import { productEntity } from '@/modules/products/entities';
import { listProducts } from '@/modules/products/service/products';
import type { ExportableEntityName } from '@/ui/views/io-columns';

export const MAX_EXPORT_ROWS = 10000;

export interface ExportSource {
  entity: EntityDef;
  fileSlug: string;   // file name prefix, e.g. contacts-2026-10-10.xlsx
  list: (ctx: Ctx, query: ListQuery) => Promise<Result<ListResult<Row>>>;
}

// Typed as a full record, so adding an exportable entity without a source is a compile error.
export const EXPORT_SOURCES: Record<ExportableEntityName, ExportSource> = {
  'contacts.partner': { entity: partnerEntity, fileSlug: 'contacts', list: listPartners },
  'products.product': { entity: productEntity, fileSlug: 'products', list: listProducts },
  'crm.lead': { entity: leadEntity, fileSlug: 'leads', list: listLeads },
};
