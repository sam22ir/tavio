import type { EntityDef } from '@/core/entities/types';

// Entity metadata for inventory records. Drives column labels and search fields.
export const stockMoveEntity: EntityDef = {
  name: 'inventory.move',
  labelField: 'reference',
  defaultSort: { field: 'reference', dir: 'desc' },
  fields: [
    { name: 'reference', type: 'text', label: 'inventory.fields.reference', list: true, search: true },
    { name: 'productName', type: 'text', label: 'inventory.fields.product', list: true, search: true },
    { name: 'quantity', type: 'number', label: 'inventory.fields.quantity', list: true },
    {
      name: 'state',
      type: 'select',
      label: 'inventory.fields.state',
      list: true,
      filter: true,
      options: [
        { value: 'draft', label: 'inventory.options.state.draft' },
        { value: 'done', label: 'inventory.options.state.done' },
        { value: 'cancelled', label: 'inventory.options.state.cancelled' },
      ],
    },
    { name: 'doneAt', type: 'datetime', label: 'inventory.fields.done_at', list: true },
  ],
};

export const warehouseEntity: EntityDef = {
  name: 'inventory.warehouse',
  labelField: 'name',
  defaultSort: { field: 'name', dir: 'asc' },
  fields: [
    { name: 'code', type: 'text', label: 'inventory.fields.code', list: true, search: true },
    { name: 'name', type: 'text', label: 'inventory.fields.name', list: true, search: true },
    { name: 'wilayaCode', type: 'text', label: 'inventory.fields.wilaya_code', list: true },
    { name: 'active', type: 'boolean', label: 'inventory.fields.active', list: true, filter: true },
  ],
};

export const reorderRuleEntity: EntityDef = {
  name: 'inventory.reorder_rule',
  labelField: 'productName',
  fields: [
    { name: 'productName', type: 'text', label: 'inventory.fields.product', list: true, search: true },
    { name: 'warehouseName', type: 'text', label: 'inventory.fields.warehouse', list: true },
    { name: 'minQty', type: 'number', label: 'inventory.fields.min_qty', list: true },
    { name: 'maxQty', type: 'number', label: 'inventory.fields.max_qty', list: true },
  ],
};
