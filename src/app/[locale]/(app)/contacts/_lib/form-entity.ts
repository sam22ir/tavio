import type { EntityDef } from '@/core/entities/types';
import { partnerEntity } from '@/modules/contacts/entities';

// National ID is not editable in P1: it needs app-level encryption (DATA_MODEL 3.1) that is not built yet.
export const PARTNER_FORM_ENTITY: EntityDef = {
  ...partnerEntity,
  fields: partnerEntity.fields.filter((f) => f.name !== 'nationalId'),
};
