import type { EntityDef } from '@/core/entities/types';

// Entity metadata for contacts.partner (DATA_MODEL.md 3.1). Drives generic list and form views.
export const partnerEntity: EntityDef = {
  name: 'contacts.partner',
  labelField: 'displayName',
  defaultSort: { field: 'displayName', dir: 'asc' },
  fields: [
    {
      name: 'kind',
      type: 'select',
      label: 'contacts.fields.kind',
      required: true,
      list: true,
      filter: true,
      options: [
        { value: 'individual', label: 'contacts.options.kind.individual' },
        { value: 'company', label: 'contacts.options.kind.company' },
      ],
    },
    { name: 'isCustomer', type: 'boolean', label: 'contacts.fields.isCustomer', list: true, filter: true },
    { name: 'isSupplier', type: 'boolean', label: 'contacts.fields.isSupplier', list: true, filter: true },
    { name: 'isProspect', type: 'boolean', label: 'contacts.fields.isProspect', list: true, filter: true },
    { name: 'active', type: 'boolean', label: 'contacts.fields.active', list: true, filter: true },
    { name: 'displayName', type: 'text', label: 'contacts.fields.displayName', readonly: true, list: true, search: true },
    { name: 'firstName', type: 'text', label: 'contacts.fields.firstName', search: true },
    { name: 'lastName', type: 'text', label: 'contacts.fields.lastName', search: true },
    { name: 'companyName', type: 'text', label: 'contacts.fields.companyName', search: true },
    { name: 'nif', type: 'text', label: 'contacts.fields.nif', search: true },
    { name: 'nis', type: 'text', label: 'contacts.fields.nis', search: true },
    { name: 'rc', type: 'text', label: 'contacts.fields.rc', search: true },
    { name: 'ai', type: 'text', label: 'contacts.fields.ai' },
    { name: 'nationalId', type: 'text', label: 'contacts.fields.nationalId' },
    { name: 'phone', type: 'phone', label: 'contacts.fields.phone', list: true, search: true },
    { name: 'phoneAlt', type: 'phone', label: 'contacts.fields.phoneAlt' },
    { name: 'email', type: 'email', label: 'contacts.fields.email', list: true, search: true },
    { name: 'address', type: 'textarea', label: 'contacts.fields.address' },
    { name: 'wilayaCode', type: 'text', label: 'contacts.fields.wilayaCode', list: true, filter: true },
    { name: 'commune', type: 'text', label: 'contacts.fields.commune', filter: true },
    { name: 'employer', type: 'text', label: 'contacts.fields.employer' },
    { name: 'monthlyIncomeCents', type: 'money', label: 'contacts.fields.monthlyIncomeCents' },
    { name: 'notes', type: 'textarea', label: 'contacts.fields.notes' },
  ],
};
