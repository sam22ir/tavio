import type { EntityDef } from '@/core/entities/types';

// Entity metadata for helpdesk.ticket. Drives the list, the form and the stage Kanban.
export const ticketEntity: EntityDef = {
  name: 'helpdesk.ticket',
  labelField: 'subject',
  defaultSort: { field: 'number', dir: 'desc' },
  kanban: { groupBy: 'stage', titleField: 'subject', subtitleField: 'number' },
  fields: [
    { name: 'number', type: 'text', label: 'helpdesk.fields.number', readonly: true, list: true, search: true },
    { name: 'subject', type: 'text', label: 'helpdesk.fields.subject', required: true, list: true, search: true },
    { name: 'partnerId', type: 'relation', label: 'helpdesk.fields.partner', list: true, filter: true, relation: { entity: 'contacts.partner', labelField: 'displayName' } },
    { name: 'teamId', type: 'relation', label: 'helpdesk.fields.team', list: true, relation: { entity: 'helpdesk.team', labelField: 'name' } },
    {
      name: 'channel',
      type: 'select',
      label: 'helpdesk.fields.channel',
      required: true,
      list: true,
      filter: true,
      options: [
        { value: 'whatsapp', label: 'helpdesk.options.channel.whatsapp' },
        { value: 'phone', label: 'helpdesk.options.channel.phone' },
        { value: 'email', label: 'helpdesk.options.channel.email' },
        { value: 'walk_in', label: 'helpdesk.options.channel.walk_in' },
      ],
    },
    {
      name: 'priority',
      type: 'select',
      label: 'helpdesk.fields.priority',
      list: true,
      filter: true,
      options: [
        { value: 'low', label: 'helpdesk.options.priority.low' },
        { value: 'normal', label: 'helpdesk.options.priority.normal' },
        { value: 'high', label: 'helpdesk.options.priority.high' },
        { value: 'urgent', label: 'helpdesk.options.priority.urgent' },
      ],
    },
    {
      name: 'stage',
      type: 'select',
      label: 'helpdesk.fields.stage',
      list: true,
      filter: true,
      readonly: true,
      options: [
        { value: 'new', label: 'helpdesk.options.stage.new' },
        { value: 'in_progress', label: 'helpdesk.options.stage.in_progress' },
        { value: 'waiting', label: 'helpdesk.options.stage.waiting' },
        { value: 'solved', label: 'helpdesk.options.stage.solved' },
        { value: 'closed', label: 'helpdesk.options.stage.closed' },
      ],
    },
    { name: 'description', type: 'textarea', label: 'helpdesk.fields.description' },
  ],
};

// Entity metadata for helpdesk.team.
export const teamEntity: EntityDef = {
  name: 'helpdesk.team',
  labelField: 'name',
  defaultSort: { field: 'name', dir: 'asc' },
  fields: [{ name: 'name', type: 'text', label: 'helpdesk.fields.teamName', required: true, list: true, search: true }],
};
