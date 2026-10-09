'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { FormState } from '@/core/entities/types';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';

export interface ActionField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'select';
  required?: boolean;
  hint?: string;
  options?: readonly { value: string; label: string }[];
}

/** Generic form bound to a server action that returns FormState. Shows field errors and follows redirects. */
export function ActionForm({
  action,
  fields,
  submitLabel,
  successMessage,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields: readonly ActionField[];
  submitLabel: string;
  successMessage?: string;
}) {
  const t = useTranslations('inventory');
  const router = useRouter();
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  useEffect(() => {
    if (state.redirectTo) router.push(state.redirectTo);
  }, [state.redirectTo, router]);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      {fields.map((field) => {
        const id = `f-${field.name}`;
        const error = state.fieldErrors?.[field.name];
        return (
          <div key={field.name} className="flex flex-col gap-1.5">
            <Label htmlFor={id}>
              {field.label}
              {field.required ? ' *' : ` (${t('common.optional')})`}
            </Label>
            {field.type === 'select' ? (
              <select
                id={id}
                name={field.name}
                required={field.required}
                className="h-9 rounded-md border bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="" disabled>
                  —
                </option>
                {field.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={id}
                name={field.name}
                type="text"
                inputMode={field.type === 'number' ? 'decimal' : undefined}
                required={field.required}
                aria-invalid={error ? true : undefined}
              />
            )}
            {field.hint ? <p className="text-xs text-muted-foreground">{field.hint}</p> : null}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
        );
      })}
      {state.ok === false && (!state.fieldErrors || state.fieldErrors._form) ? (
        <p role="alert" className="text-sm text-destructive">
          {t('common.error')}
        </p>
      ) : null}
      {state.ok === true && !state.redirectTo && successMessage ? (
        <p role="status" className="text-sm text-muted-foreground">
          {successMessage}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
