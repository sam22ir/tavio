'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import type { FormState } from '@/core/entities/types';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';

export interface SelectOption { value: string; label: string }

const SELECT_CLASS =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** New leave request. Days are computed by the server from the two dates. */
export function LeaveRequestForm({
  action,
  employees,
  types,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  employees: SelectOption[];
  types: SelectOption[];
}) {
  const t = useTranslations('hr');
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const err = (name: string) => state.fieldErrors?.[name];
  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="employeeId">{t('fields.employee')}</Label>
        <select id="employeeId" name="employeeId" required className={SELECT_CLASS} defaultValue="">
          <option value="" disabled>
            {t('fields.choose')}
          </option>
          {employees.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {err('employeeId') ? <p className="text-xs text-destructive">{err('employeeId')}</p> : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="typeId">{t('fields.leaveType')}</Label>
        <select id="typeId" name="typeId" required className={SELECT_CLASS} defaultValue="">
          <option value="" disabled>
            {t('fields.choose')}
          </option>
          {types.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {err('typeId') ? <p className="text-xs text-destructive">{err('typeId')}</p> : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fromDate">{t('fields.fromDate')}</Label>
        <Input id="fromDate" name="fromDate" type="date" required />
        {err('fromDate') ? <p className="text-xs text-destructive">{err('fromDate')}</p> : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="toDate">{t('fields.toDate')}</Label>
        <Input id="toDate" name="toDate" type="date" required />
        {err('toDate') ? <p className="text-xs text-destructive">{err('toDate')}</p> : null}
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="reason">{t('fields.reason')}</Label>
        <Input id="reason" name="reason" />
      </div>
      {state.ok === false && state.message ? (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {state.message}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {t('actions.createRequest')}
        </Button>
      </div>
    </form>
  );
}

/** Adds a leave type such as annual leave or sick leave. */
export function LeaveTypeForm({
  action,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const t = useTranslations('hr');
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="leave-type-name">{t('fields.leaveTypeName')}</Label>
        <Input id="leave-type-name" name="name" required />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {t('actions.addLeaveType')}
      </Button>
      {state.ok === false && state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
