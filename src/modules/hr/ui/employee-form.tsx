'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { useFormErrorToast } from '@/ui/feedback/use-form-error-toast';
import type { FormState } from '@/core/entities/types';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';

export interface SelectOption { value: string; label: string }

export interface EmployeeFormValues {
  id?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string | null;
  departmentId?: string | null;
  managerId?: string | null;
  hireDate?: string | null;
  phone?: string | null;
  email?: string | null;
  nin?: string | null;
  active?: boolean;
}

const SELECT_CLASS =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Create and edit form for an employee. The action returns FormState; redirects happen in the action. */
export function EmployeeForm({
  action,
  values,
  departments,
  managers,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  values?: EmployeeFormValues;
  departments: SelectOption[];
  managers: SelectOption[];
}) {
  const t = useTranslations('hr');
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  useFormErrorToast(state, state.ok === false ? (state.message ?? '') : '');
  const v = values ?? {};
  const err = (name: string) => state.fieldErrors?.[name];

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate={false}>
      {v.id ? <input type="hidden" name="id" value={v.id} /> : null}
      <Field name="firstName" label={t('fields.firstName')} defaultValue={v.firstName} required error={err('firstName')} />
      <Field name="lastName" label={t('fields.lastName')} defaultValue={v.lastName} required error={err('lastName')} />
      <Field name="jobTitle" label={t('fields.jobTitle')} defaultValue={v.jobTitle ?? ''} error={err('jobTitle')} />
      <Select name="departmentId" label={t('fields.department')} value={v.departmentId ?? ''} options={departments} emptyLabel={t('fields.noneOption')} />
      <Select
        name="managerId"
        label={t('fields.manager')}
        value={v.managerId ?? ''}
        options={managers.filter((m) => m.value !== v.id)}
        emptyLabel={t('fields.noneOption')}
      />
      <Field name="hireDate" type="date" label={t('fields.hireDate')} defaultValue={v.hireDate ?? ''} error={err('hireDate')} />
      <Field name="phone" type="tel" label={t('fields.phone')} defaultValue={v.phone ?? ''} error={err('phone')} />
      <Field name="email" type="email" label={t('fields.email')} defaultValue={v.email ?? ''} error={err('email')} />
      <Field name="nin" label={t('fields.nin')} defaultValue={v.nin ?? ''} error={err('nin')} />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="active" defaultChecked={v.id ? v.active !== false : true} className="size-4" />
        {t('fields.active')}
      </label>
      {state.ok === false && state.message ? (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {state.message}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {t('actions.save')}
        </Button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  type = 'text',
  defaultValue,
  required,
  error,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} required={required} aria-invalid={error ? true : undefined} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function Select({
  name,
  label,
  value,
  options,
  emptyLabel,
}: {
  name: string;
  label: string;
  value: string;
  options: SelectOption[];
  emptyLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={value} className={SELECT_CLASS}>
        <option value="">{emptyLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
