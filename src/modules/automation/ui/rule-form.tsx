'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { FormState } from '@/core/entities/types';
import { ACTION_NAMES } from '../config';
import { OPS } from '../conditions';
import { TRIGGER_EVENTS } from '../engine';

export interface RuleDefaults {
  id?: string;
  name?: string;
  triggerEvent?: string;
  condField?: string;
  condOp?: string;
  condValue?: string;
  action?: string;
  entity?: string;
  recordIdField?: string;
  typeKey?: string;
  summary?: string;
  dueInDays?: number;
  body?: string;
  url?: string;
  active?: boolean;
}

const field = 'flex flex-col gap-1 text-sm';
const input = 'rounded-md border bg-background px-3 py-2 text-sm';

export function RuleForm({
  action,
  defaults = {},
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  defaults?: RuleDefaults;
}) {
  const t = useTranslations('automation');
  const router = useRouter();
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  useEffect(() => {
    if (state.redirectTo) router.push(state.redirectTo);
  }, [state.redirectTo, router]);

  const err = (key: string) => state.fieldErrors?.[key];

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <label className={`${field} sm:col-span-2`}>
        {t('fields.name')}
        <input name="name" required maxLength={120} defaultValue={defaults.name} className={input} />
        {err('name') ? <span role="alert" className="text-destructive">{err('name')}</span> : null}
      </label>
      <label className={field}>
        {t('fields.triggerEvent')}
        <select name="triggerEvent" required defaultValue={defaults.triggerEvent ?? TRIGGER_EVENTS[0]} className={input}>
          {TRIGGER_EVENTS.map((e) => (
            <option key={e} value={e}>{t(`triggers.${e.replaceAll(".", "_")}`)}</option>
          ))}
        </select>
      </label>
      <fieldset className={`${field} sm:col-span-2 rounded-md border p-3`}>
        <legend>{t('fields.condition')}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          <input name="condField" placeholder={t('fields.condField')} defaultValue={defaults.condField} maxLength={100} className={input} />
          <select name="condOp" defaultValue={defaults.condOp ?? 'eq'} className={input}>
            {OPS.map((o) => (
              <option key={o} value={o}>{t(`ops.${o}`)}</option>
            ))}
          </select>
          <input name="condValue" placeholder={t('fields.condValue')} defaultValue={defaults.condValue} maxLength={200} className={input} />
        </div>
        <span className="text-xs text-muted-foreground">{t('hints.condition')}</span>
      </fieldset>
      <label className={field}>
        {t('fields.action')}
        <select name="action" required defaultValue={defaults.action ?? ACTION_NAMES[0]} className={input}>
          {ACTION_NAMES.map((a) => (
            <option key={a} value={a}>{t(`actions.${a}`)}</option>
          ))}
        </select>
      </label>
      <label className={field}>
        {t('fields.entity')}
        <input name="entity" placeholder="sales.order" defaultValue={defaults.entity} maxLength={60} className={input} />
      </label>
      <label className={field}>
        {t('fields.recordIdField')}
        <input name="recordIdField" placeholder="orderId" defaultValue={defaults.recordIdField} maxLength={100} className={input} />
      </label>
      <label className={field}>
        {t('fields.typeKey')}
        <input name="typeKey" defaultValue={defaults.typeKey} maxLength={60} className={input} />
      </label>
      <label className={field}>
        {t('fields.summary')}
        <input name="summary" defaultValue={defaults.summary} maxLength={200} className={input} />
      </label>
      <label className={field}>
        {t('fields.dueInDays')}
        <input name="dueInDays" type="number" min={0} max={365} defaultValue={defaults.dueInDays ?? 0} className={input} />
      </label>
      <label className={`${field} sm:col-span-2`}>
        {t('fields.body')}
        <textarea name="body" rows={3} maxLength={2000} defaultValue={defaults.body} className={input} />
        <span className="text-xs text-muted-foreground">{t('hints.body')}</span>
      </label>
      <label className={`${field} sm:col-span-2`}>
        {t('fields.url')}
        <input name="url" type="url" placeholder="https://" maxLength={500} defaultValue={defaults.url} className={input} />
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input name="active" type="checkbox" defaultChecked={defaults.active ?? true} />
        {t('fields.active')}
      </label>
      {err('actionConfig') ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{t('errors.actionConfig')}</p> : null}
      {state.ok === false && state.message ? (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">{t('errors.invalid')}</p>
      ) : null}
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
          {t('save')}
        </button>
      </div>
    </form>
  );
}
