import type { EntityDef } from '@/core/entities/types';

// Entity metadata for hr.employee and hr.leave_request. Drives generic list views.
export const employeeEntity: EntityDef = {
  name: 'hr.employee',
  labelField: 'displayName',
  defaultSort: { field: 'displayName', dir: 'asc' },
  fields: [
    { name: 'displayName', type: 'text', label: 'hr.fields.displayName', readonly: true, list: true, search: true },
    { name: 'jobTitle', type: 'text', label: 'hr.fields.jobTitle', list: true, search: true },
    { name: 'departmentName', type: 'text', label: 'hr.fields.department', list: true },
    { name: 'phone', type: 'phone', label: 'hr.fields.phone', list: true, search: true },
    { name: 'email', type: 'email', label: 'hr.fields.email', search: true },
    { name: 'hireDate', type: 'date', label: 'hr.fields.hireDate', list: true },
    { name: 'active', type: 'boolean', label: 'hr.fields.active', list: true, filter: true },
  ],
};

export const leaveRequestEntity: EntityDef = {
  name: 'hr.leave_request',
  labelField: 'employeeName',
  defaultSort: { field: 'fromDate', dir: 'desc' },
  fields: [
    { name: 'employeeName', type: 'text', label: 'hr.fields.employee', list: true, search: true },
    { name: 'typeName', type: 'text', label: 'hr.fields.leaveType', list: true },
    { name: 'fromDate', type: 'date', label: 'hr.fields.fromDate', list: true, filter: true },
    { name: 'toDate', type: 'date', label: 'hr.fields.toDate', list: true },
    { name: 'days', type: 'number', label: 'hr.fields.days', list: true },
    {
      name: 'state',
      type: 'select',
      label: 'hr.fields.state',
      list: true,
      filter: true,
      options: [
        { value: 'draft', label: 'hr.options.leaveState.draft' },
        { value: 'submitted', label: 'hr.options.leaveState.submitted' },
        { value: 'approved', label: 'hr.options.leaveState.approved' },
        { value: 'refused', label: 'hr.options.leaveState.refused' },
      ],
    },
  ],
};
