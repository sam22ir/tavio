import type { EntityDef } from '@/core/entities/types';
import { ticketEntity } from '@/modules/helpdesk/entities';

// Create form for a ticket. Number and stage are assigned by the service.
export const TICKET_FORM_ENTITY: EntityDef = {
  ...ticketEntity,
  fields: ticketEntity.fields.filter((f) => !['number', 'stage'].includes(f.name)),
};
