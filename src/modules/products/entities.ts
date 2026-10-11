import type { EntityDef } from '@/core/entities/types';

export const categoryEntity: EntityDef = {
  name: 'products.category',
  labelField: 'name',
  defaultSort: { field: 'name', dir: 'asc' },
  fields: [
    { name: 'name', type: 'text', label: 'products.fields.name', required: true, list: true, search: true },
    { name: 'code', type: 'text', label: 'products.fields.code', list: true, search: true },
    {
      name: 'parentId',
      type: 'relation',
      label: 'products.fields.parentId',
      relation: { entity: 'products.category', labelField: 'name' },
      list: true,
      filter: true,
    },
  ],
};

export const productEntity: EntityDef = {
  name: 'products.product',
  labelField: 'name',
  defaultSort: { field: 'name', dir: 'asc' },
  fields: [
    { name: 'name', type: 'text', label: 'products.fields.name', required: true, list: true, search: true },
    { name: 'nameAr', type: 'text', label: 'products.fields.nameAr', search: true },
    { name: 'sku', type: 'text', label: 'products.fields.sku', list: true, search: true },
    { name: 'barcode', type: 'text', label: 'products.fields.barcode', search: true },
    {
      name: 'categoryId',
      type: 'relation',
      label: 'products.fields.categoryId',
      relation: { entity: 'products.category', labelField: 'name' },
      list: true,
      filter: true,
    },
    {
      name: 'kind',
      type: 'select',
      label: 'products.fields.kind',
      required: true,
      list: true,
      filter: true,
      options: [
        { value: 'goods', label: 'products.options.kind.goods' },
        { value: 'service', label: 'products.options.kind.service' },
      ],
    },
    {
      name: 'uomId',
      type: 'relation',
      label: 'products.fields.uomId',
      required: true,
      relation: { entity: 'products.uom', labelField: 'nameFr' },
    },
    { name: 'salePriceCents', type: 'money', label: 'products.fields.salePriceCents', required: true, list: true },
    { name: 'costCents', type: 'money', label: 'products.fields.costCents', required: true },
    { name: 'trackStock', type: 'boolean', label: 'products.fields.trackStock' },
    {
      name: 'invoicePolicy',
      type: 'select',
      label: 'products.fields.invoicePolicy',
      options: [
        { value: 'order', label: 'products.options.invoicePolicy.order' },
        { value: 'delivery', label: 'products.options.invoicePolicy.delivery' },
      ],
    },
    { name: 'active', type: 'boolean', label: 'products.fields.active', list: true, filter: true },
    { name: 'description', type: 'textarea', label: 'products.fields.description' },
  ],
};
