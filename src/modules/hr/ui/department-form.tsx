'use client';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { useFormErrorToast } from '@/ui/feedback/use-form-error-toast';
import type { FormState } from '@/core/entities/types';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';

/** Adds a department. Redirects back to the list on success. */
export function DepartmentForm({
  action,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const t = useTranslations('hr');
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  useFormErrorToast(state, state.ok === false ? (state.message ?? '') : '');
  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="department-name">{t('fields.departmentName')}</Label>
        <Input id="department-name" name="name" required aria-invalid={state.fieldErrors?.name ? true : undefined} />
        {state.fieldErrors?.name ? <p className="text-xs text-danger">{state.fieldErrors.name}</p> : null}
      </div>
      <Button type="submit" disabled={pending}>
        {t('actions.addDepartment')}
      </Button>
      {state.ok === false && state.message ? (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
