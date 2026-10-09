import type { EntityDef } from '@/core/entities/types';

// Entity metadata for sales.order (W5-A). Drives the generic list view.
export const saleOrderEntity: EntityDef = {
  name: 'sales.order',
  labelField: 'number',
  defaultSort: { field: 'orderDate', dir: 'desc' },
  fields: [
    { name: 'number', type: 'text', label: 'sales.fields.number', list: true, search: true },
    {
      name: 'partnerId',
      type: 'relation',
      label: 'sales.fields.partnerId',
      list: true,
      search: false,
      relation: { entity: 'contacts.partner', labelField: 'displayName' },
    },
    {
      name: 'state',
      type: 'select',
      label: 'sales.fields.state',
      list: true,
      filter: true,
      options: [
        { value: 'draft', label: 'sales.options.state.draft' },
        { value: 'sent', label: 'sales.options.state.sent' },
        { value: 'confirmed', label: 'sales.options.state.confirmed' },
        { value: 'cancelled', label: 'sales.options.state.cancelled' },
        { value: 'done', label: 'sales.options.state.done' },
      ],
    },
    { name: 'orderDate', type: 'date', label: 'sales.fields.orderDate', list: true, filter: true },
    { name: 'validityDate', type: 'date', label: 'sales.fields.validityDate' },
    { name: 'untaxedCents', type: 'money', label: 'sales.fields.untaxedCents', readonly: true },
    { name: 'taxCents', type: 'money', label: 'sales.fields.taxCents', readonly: true },
    { name: 'totalCents', type: 'money', label: 'sales.fields.totalCents', list: true, readonly: true },
    { name: 'invoiced', type: 'boolean', label: 'sales.fields.invoiced', list: true, filter: true },
    { name: 'note', type: 'textarea', label: 'sales.fields.note' },
  ],
};
