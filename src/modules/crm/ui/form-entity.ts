import { leadEntity } from '@/modules/crm/entities';

// Lead fields shown in RecordForm. lostReasonId is set only through Mark lost.
export const leadFormEntity = {
  ...leadEntity,
  fields: leadEntity.fields.filter((f) => f.name !== 'lostReasonId'),
};
