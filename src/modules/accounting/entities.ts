import type { EntityDef } from '@/core/entities/types';

// Entity metadata for accounting.account and accounting.entry. Drives the generic list views.
export const accountEntity: EntityDef = {
  name: 'accounting.account',
  labelField: 'name',
  defaultSort: { field: 'code', dir: 'asc' },
  fields: [
    { name: 'code', type: 'text', label: 'accounting.fields.code', list: true, search: true },
    { name: 'name', type: 'text', label: 'accounting.fields.name', list: true, search: true },
    {
      name: 'type',
      type: 'select',
      label: 'accounting.fields.type',
      list: true,
      filter: true,
      options: [
        { value: 'asset', label: 'accounting.options.type.asset' },
        { value: 'liability', label: 'accounting.options.type.liability' },
        { value: 'equity', label: 'accounting.options.type.equity' },
        { value: 'income', label: 'accounting.options.type.income' },
        { value: 'expense', label: 'accounting.options.type.expense' },
      ],
    },
    { name: 'accountClass', type: 'number', label: 'accounting.fields.accountClass', list: true, filter: true },
  ],
};

export const entryEntity: EntityDef = {
  name: 'accounting.entry',
  labelField: 'number',
  defaultSort: { field: 'date', dir: 'desc' },
  fields: [
    { name: 'number', type: 'text', label: 'accounting.fields.number', list: true, search: true },
    { name: 'date', type: 'date', label: 'accounting.fields.date', list: true, filter: true },
    { name: 'sourceId', type: 'text', label: 'accounting.fields.number', readonly: true, filter: true },
    { name: 'journalLabel', type: 'text', label: 'accounting.fields.journal', list: true },
    { name: 'ref', type: 'text', label: 'accounting.fields.ref', list: true, search: true },
    {
      name: 'state',
      type: 'select',
      label: 'accounting.fields.state',
      list: true,
      filter: true,
      options: [
        { value: 'draft', label: 'accounting.options.state.draft' },
        { value: 'posted', label: 'accounting.options.state.posted' },
      ],
    },
  ],
};
