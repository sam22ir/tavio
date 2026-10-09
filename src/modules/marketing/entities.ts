import type { EntityDef } from '@/core/entities/types';

// Entity metadata for marketing.campaign. Labels are i18n keys under the `marketing` namespace.
// The segment is flattened into segment* fields so the generic RecordForm can edit it.
export const campaignEntity: EntityDef = {
  name: 'marketing.campaign',
  labelField: 'name',
  defaultSort: { field: 'name', dir: 'asc' },
  fields: [
    { name: 'name', type: 'text', label: 'marketing.fields.name', required: true, list: true, search: true },
    {
      name: 'channel',
      type: 'select',
      label: 'marketing.fields.channel',
      required: true,
      list: true,
      filter: true,
      options: [
        { value: 'whatsapp', label: 'marketing.options.channel.whatsapp' },
        { value: 'sms', label: 'marketing.options.channel.sms' },
        { value: 'email', label: 'marketing.options.channel.email' },
      ],
    },
    {
      name: 'language',
      type: 'select',
      label: 'marketing.fields.language',
      required: true,
      list: true,
      options: [
        { value: 'fr', label: 'marketing.options.language.fr' },
        { value: 'ar', label: 'marketing.options.language.ar' },
      ],
    },
    { name: 'messageFr', type: 'textarea', label: 'marketing.fields.messageFr', required: true },
    { name: 'messageAr', type: 'textarea', label: 'marketing.fields.messageAr', required: true },
    { name: 'segmentCustomer', type: 'boolean', label: 'marketing.fields.segmentCustomer', filter: true },
    { name: 'segmentProspect', type: 'boolean', label: 'marketing.fields.segmentProspect', filter: true },
    { name: 'segmentWilaya', type: 'text', label: 'marketing.fields.segmentWilaya', filter: true },
    { name: 'segmentHasOverdue', type: 'boolean', label: 'marketing.fields.segmentHasOverdue', filter: true },
    {
      name: 'state',
      type: 'select',
      label: 'marketing.fields.state',
      readonly: true,
      list: true,
      filter: true,
      options: [
        { value: 'draft', label: 'marketing.options.state.draft' },
        { value: 'ready', label: 'marketing.options.state.ready' },
        { value: 'sent', label: 'marketing.options.state.sent' },
      ],
    },
  ],
};
