'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useFormErrorToast } from '@/ui/feedback/use-form-error-toast';
import type { FormState } from '@/core/entities/types';
import { ACTION_NAMES } from '../config';
import { OPS } from '../conditions';
import { TIME_ENTITIES, UPDATE_ENTITIES } from '../fields';
import { TRIGGER_EVENTS } from '../config';

export interface RuleDefaults {
  id?: string;
  name?: string;
  kind?: string;
  triggerEvent?: string;
  timeEntity?: string;
  dateField?: string;
  delayDays?: number;
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
  planId?: string;
  ownerField?: string;
  cancelPrevious?: boolean;
  updates?: string;
  steps?: string;
  active?: boolean;
}

const field = 'flex flex-col gap-1 text-sm';
const input =
  'min-h-11 w-full rounded-xl border border-separator bg-surface px-3 py-2 text-sm placeholder:text-muted focus-visible:outline-2 focus-visible:outline-focus';
const section = 'flex flex-col gap-3 rounded-2xl bg-surface-secondary p-4 sm:col-span-2';
const sectionGrid = 'grid gap-3 sm:grid-cols-2';

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <fieldset className={section}>
      <legend className="sr-only">{title}</legend>
      <h3 className="flex items-center gap-2 text-sm font-semibold" aria-hidden="true">
        <span className="flex size-6 items-center justify-center rounded-full bg-accent text-xs text-accent-foreground">{n}</span>
        {title}
      </h3>
      <div className={sectionGrid}>{children}</div>
    </fieldset>
  );
}

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
  useFormErrorToast(state, state.ok === false && state.message ? t('errors.invalid') : '');
  const [kind, setKind] = useState(defaults.kind ?? 'event');
  const [chosenAction, setChosenAction] = useState<string>(defaults.action ?? ACTION_NAMES[0] ?? 'webhook');

  useEffect(() => {
    if (state.redirectTo) router.push(state.redirectTo);
  }, [state.redirectTo, router]);

  const err = (key: string) => state.fieldErrors?.[key];
  const usesEntity = ['create_activity', 'post_note', 'update_record', 'launch_activity_plan', 'cancel_activity_plans'].includes(chosenAction);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <label className={`${field} sm:col-span-2`}>
        {t('fields.name')}
        <input name="name" required maxLength={120} defaultValue={defaults.name} className={input} />
        {err('name') ? <span role="alert" className="text-danger">{err('name')}</span> : null}
      </label>
      <Section n={1} title={t('sections.when')}>
      <label className={field}>
        {t('fields.kind')}
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={input}>
          <option value="event">{t('kinds.event')}</option>
          <option value="time">{t('kinds.time')}</option>
        </select>
      </label>
      {kind === 'time' ? (
        <div className={`${field} sm:col-span-2`}>
          <span className="font-medium">{t('fields.whenDate')}</span>
          <div className="grid gap-2 sm:grid-cols-3">
            <select name="timeEntity" defaultValue={defaults.timeEntity ?? TIME_ENTITIES[0]} className={input}>
              {TIME_ENTITIES.map((e) => (
                <option key={e} value={e}>{t(`timeEntities.${e}`)}</option>
              ))}
            </select>
            <input name="dateField" placeholder="stage_entered_at" defaultValue={defaults.dateField} maxLength={60} className={input} />
            <input name="delayDays" type="number" min={0} max={3650} placeholder={t('fields.delayDays')} defaultValue={defaults.delayDays ?? 0} className={input} />
          </div>
          <span className="text-xs text-muted">{t('hints.time')}</span>
          {err('timeConfig') ? <span role="alert" className="text-danger">{t('errors.timeConfig')}</span> : null}
        </div>
      ) : (
        <label className={field}>
          {t('fields.triggerEvent')}
          <select name="triggerEvent" required={kind === 'event'} defaultValue={defaults.triggerEvent ?? TRIGGER_EVENTS[0]} className={input}>
            {TRIGGER_EVENTS.map((e) => (
              <option key={e} value={e}>{t(`triggers.${e.replaceAll(".", "_")}`)}</option>
            ))}
          </select>
        </label>
      )}
      </Section>
      <Section n={2} title={t('sections.if')}>
      <div className={`${field} sm:col-span-2`}>
        <div className="grid gap-2 sm:grid-cols-3">
          <input name="condField" placeholder={t('fields.condField')} defaultValue={defaults.condField} maxLength={100} className={input} />
          <select name="condOp" defaultValue={defaults.condOp ?? 'eq'} className={input}>
            {OPS.map((o) => (
              <option key={o} value={o}>{t(`ops.${o}`)}</option>
            ))}
          </select>
          <input name="condValue" placeholder={t('fields.condValue')} defaultValue={defaults.condValue} maxLength={200} className={input} />
        </div>
        <span className="text-xs text-muted">{t('hints.condition')}</span>
      </div>
      </Section>
      <Section n={3} title={t('sections.then')}>
      <label className={field}>
        {t('fields.action')}
        <select name="action" required value={chosenAction} onChange={(e) => setChosenAction(e.target.value)} className={input}>
          {ACTION_NAMES.map((a) => (
            <option key={a} value={a}>{t(`actions.${a}`)}</option>
          ))}
        </select>
      </label>
      {usesEntity ? (
        <label className={field}>
          {t('fields.entity')}
          <input
            name="entity"
            list={chosenAction === 'update_record' ? 'automation-update-entities' : undefined}
            placeholder={chosenAction === 'update_record' ? 'lead' : 'sales.order'}
            defaultValue={defaults.entity}
            maxLength={60}
            className={input}
          />
          {chosenAction === 'update_record' ? (
            <datalist id="automation-update-entities">
              {UPDATE_ENTITIES.map((e) => <option key={e} value={e} />)}
            </datalist>
          ) : null}
        </label>
      ) : null}
      {usesEntity ? (
        <label className={field}>
          {t('fields.recordIdField')}
          <input name="recordIdField" placeholder="orderId" defaultValue={defaults.recordIdField ?? (kind === 'time' ? 'id' : '')} maxLength={100} className={input} />
        </label>
      ) : null}
      {chosenAction === 'create_activity' ? (
        <>
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
        </>
      ) : null}
      {chosenAction === 'launch_activity_plan' ? (
        <>
          <label className={field}>
            {t('fields.planId')}
            <input name="planId" defaultValue={defaults.planId} maxLength={60} className={input} />
          </label>
          <label className={field}>
            {t('fields.ownerField')}
            <input name="ownerField" placeholder="ownerId" defaultValue={defaults.ownerField} maxLength={100} className={input} />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input name="cancelPrevious" type="checkbox" defaultChecked={defaults.cancelPrevious ?? true} />
            {t('fields.cancelPrevious')}
          </label>
        </>
      ) : null}
      {chosenAction === 'update_record' ? (
        <label className={`${field} sm:col-span-2`}>
          {t('fields.updates')}
          <textarea name="updates" rows={3} defaultValue={defaults.updates} className={input} />
          <span className="text-xs text-muted">{t('hints.updates')}</span>
        </label>
      ) : null}
      {chosenAction === 'multi' ? (
        <label className={`${field} sm:col-span-2`}>
          {t('fields.steps')}
          <textarea name="steps" rows={5} defaultValue={defaults.steps} className={`${input} font-mono`} />
          <span className="text-xs text-muted">{t('hints.steps')}</span>
        </label>
      ) : null}
      {chosenAction === 'post_note' ? (
        <label className={`${field} sm:col-span-2`}>
          {t('fields.body')}
          <textarea name="body" rows={3} maxLength={2000} defaultValue={defaults.body} className={input} />
          <span className="text-xs text-muted">{t('hints.body')}</span>
        </label>
      ) : null}
      {chosenAction === 'webhook' ? (
        <label className={`${field} sm:col-span-2`}>
          {t('fields.url')}
          <input name="url" type="url" placeholder="https://" maxLength={500} defaultValue={defaults.url} className={input} />
        </label>
      ) : null}
      </Section>
      <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
        <input name="active" type="checkbox" defaultChecked={defaults.active ?? true} className="size-4 accent-[var(--accent)]" />
        {t('fields.active')}
      </label>
      {err('actionConfig') ? <p role="alert" className="text-sm text-danger sm:col-span-2">{t('errors.actionConfig')}</p> : null}
      {state.ok === false && state.message ? (
        <p role="alert" className="text-sm text-danger sm:col-span-2">{t('errors.invalid')}</p>
      ) : null}
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground transition-opacity disabled:opacity-50">
          {t('save')}
        </button>
      </div>
    </form>
  );
}
