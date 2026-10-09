import type { EntityDef } from '@/core/entities/types';

// Entity metadata for purchases.order (DATA_MODEL P5). Drives the generic list view.
export const purchaseOrderEntity: EntityDef = {
  name: 'purchases.order',
  labelField: 'number',
  defaultSort: { field: 'orderDate', dir: 'desc' },
  fields: [
    { name: 'number', type: 'text', label: 'purchases.fields.number', list: true, search: true },
    { name: 'partnerName', type: 'text', label: 'purchases.fields.partner', list: true, search: true },
    {
      name: 'state',
      type: 'select',
      label: 'purchases.fields.state',
      list: true,
      filter: true,
      options: [
        { value: 'draft', label: 'purchases.state.draft' },
        { value: 'sent', label: 'purchases.state.sent' },
        { value: 'confirmed', label: 'purchases.state.confirmed' },
        { value: 'received', label: 'purchases.state.received' },
        { value: 'cancelled', label: 'purchases.state.cancelled' },
      ],
    },
    { name: 'orderDate', type: 'date', label: 'purchases.fields.orderDate', list: true, filter: true },
    { name: 'totalCents', type: 'money', label: 'purchases.fields.total', list: true },
  ],
};
