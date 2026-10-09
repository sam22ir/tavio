'use server';

import { failureQuery } from '@/ui/feedback/failure-query';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { defineAction, toFormAction } from '@/core/actions/define-action';
import type { FormState } from '@/core/entities/types';
import {
  createDepartment,
  createEmployee,
  departmentInput,
  employeeInput,
  getEmployeeForUser,
  setEmployeeActive,
  updateEmployee,
} from './service/employees';
import { checkIn, checkOut } from './service/attendance';
import {
  createLeaveRequest,
  createLeaveType,
  decideLeave,
  leaveInput,
  leaveTypeInput,
  submitLeave,
} from './service/leave';

const MODULE = 'hr';
const WRITE_EMP = 'hr.employee.write';
const WRITE_LEAVE = 'hr.leave.write';
const WRITE_ATT = 'hr.attendance.write';

const idInput = z.object({ id: z.uuid() });
const emptyInput = z.object({});

const createEmployeeAction = defineAction({ perm: WRITE_EMP, schema: employeeInput, module: MODULE }, createEmployee);

const updateEmployeeAction = defineAction(
  { perm: WRITE_EMP, schema: employeeInput.and(idInput), module: MODULE },
  (ctx, { id, ...input }) => updateEmployee(ctx, id, input),
);

const setActiveAction = defineAction(
  { perm: WRITE_EMP, schema: idInput.extend({ active: z.boolean() }), module: MODULE },
  (ctx, { id, active }) => setEmployeeActive(ctx, id, active),
);

const createDepartmentAction = defineAction(
  { perm: 'hr.department.write', schema: departmentInput, module: MODULE },
  createDepartment,
);

const createLeaveAction = defineAction({ perm: WRITE_LEAVE, schema: leaveInput, module: MODULE }, createLeaveRequest);

const submitLeaveAction = defineAction({ perm: WRITE_LEAVE, schema: idInput, module: MODULE }, (ctx, { id }) =>
  submitLeave(ctx, id),
);

const decideLeaveAction = defineAction(
  { perm: 'hr.leave.approve', schema: idInput.extend({ decision: z.enum(['approved', 'refused']) }), module: MODULE },
  (ctx, { id, decision }) => decideLeave(ctx, id, decision),
);

const createLeaveTypeAction = defineAction({ perm: WRITE_LEAVE, schema: leaveTypeInput, module: MODULE }, createLeaveType);

const checkInSelfAction = defineAction({ perm: WRITE_ATT, schema: emptyInput, module: MODULE }, async (ctx) => {
  const me = await getEmployeeForUser(ctx);
  if (!me.ok) return me;
  return checkIn(ctx, me.value.id);
});

const checkOutSelfAction = defineAction({ perm: WRITE_ATT, schema: emptyInput, module: MODULE }, async (ctx) => {
  const me = await getEmployeeForUser(ctx);
  if (!me.ok) return me;
  return checkOut(ctx, me.value.id);
});

/** Form action for /hr/employees/new. */
export async function createEmployeeForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(createEmployeeAction, {
    schema: employeeInput,
    redirectTo: ({ id }) => `/${locale}/hr/employees/${id}`,
  })(prev, formData);
}

/** Form action for the edit form on /hr/employees/[id]. Carries a hidden `id`. */
export async function updateEmployeeForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  const id = String(formData.get('id') ?? '');
  return toFormAction(updateEmployeeAction, {
    schema: employeeInput.and(idInput),
    redirectTo: () => `/${locale}/hr/employees/${encodeURIComponent(id)}`,
  })(prev, formData);
}

/** Archive or reactivate an employee. Records are never deleted. */
export async function toggleEmployeeActiveForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const id = String(formData.get('id') ?? '');
  const active = formData.get('active') === 'true';
  await setActiveAction({ id, active });
  redirect(`/${locale}/hr/employees/${encodeURIComponent(id)}`);
}

export async function createDepartmentForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(createDepartmentAction, {
    schema: departmentInput,
    redirectTo: () => `/${locale}/hr/departments`,
  })(prev, formData);
}

export async function createLeaveForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(createLeaveAction, {
    schema: leaveInput,
    redirectTo: () => `/${locale}/hr/leave`,
  })(prev, formData);
}

export async function createLeaveTypeForm(prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await getLocale();
  return toFormAction(createLeaveTypeAction, {
    schema: leaveTypeInput,
    redirectTo: () => `/${locale}/hr/leave`,
  })(prev, formData);
}

export async function submitLeaveForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const r = await submitLeaveAction({ id: String(formData.get('id') ?? '') });
  redirect(`/${locale}/hr/leave${failureQuery(r)}`);
}

export async function decideLeaveForm(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const decision = formData.get('decision') === 'refused' ? 'refused' : 'approved';
  const r = await decideLeaveAction({ id: String(formData.get('id') ?? ''), decision });
  redirect(`/${locale}/hr/leave${failureQuery(r)}`);
}

export async function checkInSelfForm(): Promise<void> {
  const locale = await getLocale();
  const r = await checkInSelfAction({});
  redirect(`/${locale}/hr/attendance${failureQuery(r)}`);
}

export async function checkOutSelfForm(): Promise<void> {
  const locale = await getLocale();
  const r = await checkOutSelfAction({});
  redirect(`/${locale}/hr/attendance${failureQuery(r)}`);
}
