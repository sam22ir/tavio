import type { EntityDef } from '@/core/entities/types';
import { projectEntity } from '@/modules/projects/entities';

// Create form for a project: name and customer. State changes use the detail page buttons.
export const PROJECT_FORM_ENTITY: EntityDef = {
  ...projectEntity,
  fields: projectEntity.fields.filter((f) => f.name === 'name' || f.name === 'partnerId'),
};
