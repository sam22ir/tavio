import type { EntityDef } from '@/core/entities/types';

// Storefront settings form (website_settings).
export const websiteSettingsEntity: EntityDef = {
  name: 'website.settings',
  labelField: 'title',
  fields: [
    { name: 'enabled', type: 'boolean', label: 'website.fields.enabled' },
    { name: 'slug', type: 'text', label: 'website.fields.slug', required: true },
    { name: 'title', type: 'text', label: 'website.fields.title', required: true },
    { name: 'about', type: 'textarea', label: 'website.fields.about' },
    { name: 'phoneWhatsapp', type: 'phone', label: 'website.fields.phoneWhatsapp' },
    { name: 'showPrices', type: 'boolean', label: 'website.fields.showPrices' },
  ],
};

// Web orders list (web_orders).
export const webOrderEntity: EntityDef = {
  name: 'website.web_order',
  labelField: 'number',
  defaultSort: { field: 'number', dir: 'desc' },
  fields: [
    { name: 'number', type: 'text', label: 'website.fields.number', list: true, search: true },
    { name: 'customerName', type: 'text', label: 'website.fields.customerName', list: true, search: true },
    { name: 'phone', type: 'phone', label: 'website.fields.phone', list: true, search: true },
    { name: 'wilayaCode', type: 'text', label: 'website.fields.wilayaCode', list: true, filter: true },
    { name: 'totalCents', type: 'money', label: 'website.fields.totalCents', list: true },
    {
      name: 'state',
      type: 'select',
      label: 'website.fields.state',
      list: true,
      filter: true,
      options: [
        { value: 'new', label: 'website.options.state.new' },
        { value: 'confirmed', label: 'website.options.state.confirmed' },
        { value: 'cancelled', label: 'website.options.state.cancelled' },
      ],
    },
  ],
};
