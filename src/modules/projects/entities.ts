import type { EntityDef } from '@/core/entities/types';

// Entity metadata for projects.project. Drives the generic list and form views.
export const projectEntity: EntityDef = {
  name: 'projects.project',
  labelField: 'name',
  defaultSort: { field: 'name', dir: 'asc' },
  fields: [
    { name: 'name', type: 'text', label: 'projects.fields.name', required: true, list: true, search: true },
    { name: 'partnerId', type: 'relation', label: 'projects.fields.partner', list: true, relation: { entity: 'contacts.partner', labelField: 'displayName' } },
    {
      name: 'state',
      type: 'select',
      label: 'projects.fields.state',
      list: true,
      filter: true,
      options: [
        { value: 'active', label: 'projects.options.state.active' },
        { value: 'done', label: 'projects.options.state.done' },
        { value: 'archived', label: 'projects.options.state.archived' },
      ],
    },
  ],
};

// Entity metadata for projects.task. Drives the task Kanban and the task form.
export const taskEntity: EntityDef = {
  name: 'projects.task',
  labelField: 'name',
  defaultSort: { field: 'name', dir: 'asc' },
  kanban: { groupBy: 'stageId', titleField: 'name', subtitleField: 'deadline' },
  fields: [
    { name: 'name', type: 'text', label: 'projects.fields.name', required: true, list: true, search: true },
    {
      name: 'priority',
      type: 'select',
      label: 'projects.fields.priority',
      list: true,
      filter: true,
      options: [
        { value: 'low', label: 'projects.options.priority.low' },
        { value: 'normal', label: 'projects.options.priority.normal' },
        { value: 'high', label: 'projects.options.priority.high' },
        { value: 'urgent', label: 'projects.options.priority.urgent' },
      ],
    },
    { name: 'deadline', type: 'date', label: 'projects.fields.deadline', list: true },
    { name: 'description', type: 'textarea', label: 'projects.fields.description' },
  ],
};

// Entity metadata for projects.timesheet. Hours are typed as text and parsed by parseHours.
export const timesheetEntity: EntityDef = {
  name: 'projects.timesheet',
  labelField: 'date',
  defaultSort: { field: 'date', dir: 'desc' },
  fields: [
    { name: 'date', type: 'date', label: 'projects.fields.date', required: true, list: true },
    { name: 'hours', type: 'text', label: 'projects.fields.hours', required: true, list: true },
    { name: 'description', type: 'textarea', label: 'projects.fields.description', list: true },
  ],
};
