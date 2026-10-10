import type { EntityDef } from '@/core/entities/types';

// Entity metadata for generic list, form and kanban views (CONVENTIONS.md, ARCHITECTURE.md 5).
// Labels are i18n keys under the `credit` namespace.

const partnerRelation = { entity: 'contacts.partner', labelField: 'displayName' } as const;

export const contractEntity: EntityDef = {
  name: 'credit_sales.contract',
  labelField: 'reference',
  defaultSort: { field: 'startDate', dir: 'desc' },
  fields: [
    { name: 'reference', type: 'text', label: 'credit.fields.reference', readonly: true, list: true, search: true },
    { name: 'partnerId', type: 'relation', label: 'credit.fields.partnerId', required: true, relation: partnerRelation, list: true, search: true, filter: true },
    {
      name: 'state',
      type: 'select',
      label: 'credit.fields.state',
      list: true,
      filter: true,
      readonly: true,
      options: [
        { value: 'draft', label: 'credit.options.state.draft' },
        { value: 'submitted', label: 'credit.options.state.submitted' },
        { value: 'under_review', label: 'credit.options.state.under_review' },
        { value: 'approved', label: 'credit.options.state.approved' },
        { value: 'refused', label: 'credit.options.state.refused' },
        { value: 'reserved', label: 'credit.options.state.reserved' },
        { value: 'active', label: 'credit.options.state.active' },
        { value: 'completed', label: 'credit.options.state.completed' },
        { value: 'cancelled', label: 'credit.options.state.cancelled' },
        { value: 'defaulted', label: 'credit.options.state.defaulted' },
      ],
    },
    { name: 'startDate', type: 'date', label: 'credit.fields.startDate', required: true, list: true, filter: true },
    {
      name: 'frequency',
      type: 'select',
      label: 'credit.fields.frequency',
      required: true,
      list: true,
      filter: true,
      options: [
        { value: 'monthly', label: 'credit.options.frequency.monthly' },
        { value: 'weekly', label: 'credit.options.frequency.weekly' },
      ],
    },
    { name: 'installmentsCount', type: 'number', label: 'credit.fields.installmentsCount', required: true, list: true },
    { name: 'cashPriceCents', type: 'money', label: 'credit.fields.cashPriceCents', readonly: true, list: true },
    { name: 'markupRate', type: 'number', label: 'credit.fields.markupRate' },
    { name: 'markupCents', type: 'money', label: 'credit.fields.markupCents', readonly: true },
    { name: 'totalCents', type: 'money', label: 'credit.fields.totalCents', readonly: true, list: true },
    { name: 'downPaymentCents', type: 'money', label: 'credit.fields.downPaymentCents', required: true },
    { name: 'financedCents', type: 'money', label: 'credit.fields.financedCents', readonly: true },
    { name: 'notes', type: 'textarea', label: 'credit.fields.notes' },
  ],
};

export const paymentEntity: EntityDef = {
  name: 'credit_sales.payment',
  labelField: 'reference',
  defaultSort: { field: 'receivedAt', dir: 'desc' },
  fields: [
    { name: 'reference', type: 'text', label: 'credit.fields.reference', readonly: true, list: true, search: true },
    { name: 'partnerId', type: 'relation', label: 'credit.fields.partnerId', required: true, relation: partnerRelation, list: true, search: true, filter: true },
    {
      name: 'state',
      type: 'select',
      label: 'credit.fields.state',
      list: true,
      filter: true,
      readonly: true,
      options: [
        { value: 'posted', label: 'credit.options.state.posted' },
        { value: 'reversed', label: 'credit.options.state.reversed' },
      ],
    },
    {
      name: 'method',
      type: 'select',
      label: 'credit.fields.method',
      required: true,
      list: true,
      filter: true,
      options: [
        { value: 'cash', label: 'credit.options.method.cash' },
        { value: 'ccp', label: 'credit.options.method.ccp' },
        { value: 'transfer', label: 'credit.options.method.transfer' },
        { value: 'cib', label: 'credit.options.method.cib' },
        { value: 'edahabia', label: 'credit.options.method.edahabia' },
        { value: 'cheque', label: 'credit.options.method.cheque' },
      ],
    },
    { name: 'amountCents', type: 'money', label: 'credit.fields.amountCents', required: true, list: true },
    { name: 'receivedAt', type: 'datetime', label: 'credit.fields.receivedAt', required: true, list: true, filter: true },
    { name: 'externalRef', type: 'text', label: 'credit.fields.externalRef', search: true },
    { name: 'bankName', type: 'text', label: 'credit.fields.bankName' },
    { name: 'chequeDueDate', type: 'date', label: 'credit.fields.chequeDueDate' },
    { name: 'note', type: 'textarea', label: 'credit.fields.note' },
  ],
};
