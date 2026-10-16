'use client';

import { toast } from 'sonner';
import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { saveCustomValuesAction } from '../actions';
import type { CustomEntity } from '../constants';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';

export interface CustomFieldView {
  key: string;
  labelFr: string;
  labelAr: string;
  labelEn: string;
  fieldType: 'text' | 'number' | 'date' | 'boolean' | 'select';
  options: string[];
  required: boolean;
}

const SELECT_CLASS =
  'h-11 w-full rounded-xl border border-separator bg-surface px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

/** Reads and writes a record's custom values. Mounted by the integrator on the contact detail page. */
export function CustomFieldsEditor({
  entity,
  recordId,
  fields,
  values,
}: {
  entity: CustomEntity;
  recordId: string;
  fields: CustomFieldView[];
  values: Record<string, string | number | boolean | null>;
}) {
  const t = useTranslations('platform');
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Record<string, unknown>>(values);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const labelOf = (f: CustomFieldView) => (locale === 'ar' ? f.labelAr : locale === 'en' ? f.labelEn : f.labelFr);

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    start(async () => {
      const r = await saveCustomValuesAction({ entity, recordId, values: draft });
      if (r.ok) setMessage({ kind: 'ok', text: t('custom.saved') });
      else {
        const text = r.error.code === 'VALIDATION' ? t('custom.invalid') : t('errors.generic');
        setMessage({ kind: 'error', text });
        toast.error(text);
      }
    });
  }

  if (fields.length === 0) return <p className="text-sm text-muted">{t('custom.empty')}</p>;

  return (
    <form onSubmit={onSave} className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => {
        const id = `cf-${f.key}`;
        const current = draft[f.key];
        if (f.fieldType === 'boolean') {
          return (
            <label key={f.key} className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="size-5"
                checked={current === true}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.checked })}
              />
              {labelOf(f)}
            </label>
          );
        }
        if (f.fieldType === 'select') {
          return (
            <div key={f.key} className="flex flex-col gap-2">
              <Label htmlFor={id}>{labelOf(f)}</Label>
              <select id={id} className={SELECT_CLASS} value={typeof current === 'string' ? current : ''} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}>
                <option value="">{t('custom.none')}</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          );
        }
        const type = f.fieldType === 'number' ? 'number' : f.fieldType === 'date' ? 'date' : 'text';
        return (
          <div key={f.key} className="flex flex-col gap-2">
            <Label htmlFor={id}>{labelOf(f)}</Label>
            <Input
              id={id}
              type={type}
              className="min-h-11"
              required={f.required}
              value={current === null || current === undefined ? '' : String(current)}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
            />
          </div>
        );
      })}
      <div className="sm:col-span-2 flex flex-col gap-2">
        <Button type="submit" disabled={pending} className="min-h-11 self-start">{t('custom.save')}</Button>
        {message ? (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'text-sm text-danger' : 'text-sm'}>
            {message.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}
