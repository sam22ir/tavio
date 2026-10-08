import type { EntityDef } from '@/core/entities/types';

export const taxEntity: EntityDef = {
  name: 'l10n_dz.tax',
  labelField: 'name',
  fields: [
    { name: 'code', type: 'text', label: 'l10n.fields.code', required: true, list: true, search: true },
    { name: 'name', type: 'text', label: 'l10n.fields.name', required: true, list: true, search: true },
    {
      name: 'kind',
      type: 'select',
      label: 'l10n.fields.kind',
      required: true,
      list: true,
      filter: true,
      options: [
        { value: 'vat', label: 'l10n.options.kind.vat' },
        { value: 'stamp', label: 'l10n.options.kind.stamp' },
        { value: 'other', label: 'l10n.options.kind.other' },
      ],
    },
    { name: 'rate', type: 'number', label: 'l10n.fields.rate', required: true, list: true },
    {
      name: 'scope',
      type: 'select',
      label: 'l10n.fields.scope',
      required: true,
      list: true,
      filter: true,
      options: [
        { value: 'sale', label: 'l10n.options.scope.sale' },
        { value: 'purchase', label: 'l10n.options.scope.purchase' },
        { value: 'both', label: 'l10n.options.scope.both' },
      ],
    },
    { name: 'validFrom', type: 'date', label: 'l10n.fields.validFrom', required: true, list: true },
    { name: 'validTo', type: 'date', label: 'l10n.fields.validTo', list: true },
    { name: 'active', type: 'boolean', label: 'l10n.fields.active', list: true, filter: true },
    { name: 'legalRef', type: 'text', label: 'l10n.fields.legalRef' },
    { name: 'isDefaultSale', type: 'boolean', label: 'l10n.fields.isDefaultSale' },
    { name: 'isDefaultPurchase', type: 'boolean', label: 'l10n.fields.isDefaultPurchase' },
  ],
  defaultSort: { field: 'code', dir: 'asc' },
};

export const entities = [taxEntity] as const;
