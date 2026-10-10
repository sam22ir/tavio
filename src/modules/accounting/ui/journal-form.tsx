'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { createJournalForm, updateJournalForm } from '../actions';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import type { FormState } from '@/core/entities/types';

export interface JournalFormValues {
  id: string;
  code: string;
  name: string;
  type: 'sale' | 'purchase' | 'cash' | 'bank' | 'misc' | 'general';
}

const TYPES = ['sale', 'purchase', 'cash', 'bank', 'misc'] as const;

// Create a custom journal, or edit one. The code is fixed because entry numbers use it.
export function JournalForm({ journal }: { journal?: JournalFormValues }) {
  const t = useTranslations('accounting');
  const [createState, createAction] = useActionState<FormState, FormData>(createJournalForm, {});
  const [editState, editAction] = useActionState<FormState, FormData>(updateJournalForm, {});
  const state = journal ? editState : createState;
  const current = journal?.type === 'general' ? 'misc' : journal?.type ?? 'misc';

  return (
    <div className="flex flex-col gap-4">
      <form action={journal ? editAction : createAction} className="grid gap-3 sm:grid-cols-3">
        {journal ? <input type="hidden" name="id" value={journal.id} /> : null}
        <div className="flex flex-col gap-1">
          <Label htmlFor="j-code">{t('fields.code')}</Label>
          <Input id="j-code" name="code" defaultValue={journal?.code ?? ''} disabled={!!journal} required={!journal} maxLength={6} className="uppercase" />
          {state.fieldErrors?.code ? <p className="text-sm text-destructive">{state.fieldErrors.code}</p> : null}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="j-name">{t('fields.name')}</Label>
          <Input id="j-name" name="name" defaultValue={journal?.name ?? ''} required maxLength={80} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="j-type">{t('fields.type')}</Label>
          <select id="j-type" name="type" defaultValue={current} className="h-11 rounded-md border bg-background px-3 text-sm">
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>{t(`options.journalType.${ty}`)}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-3">
          <Button type="submit" className="min-h-11">{journal ? t('form.save') : t('form.create')}</Button>
        </div>
      </form>
      {state.ok === false ? (
        <p role="alert" className="text-sm text-destructive">{state.message && t.has(`errors.${state.message}`) ? t(`errors.${state.message}`) : t('errors.generic')}</p>
      ) : null}
    </div>
  );
}
