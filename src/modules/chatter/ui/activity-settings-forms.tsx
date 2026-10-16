'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { ActivityType } from '../schema';
import type { PlanWithSteps } from '../service';
import { saveActivityTypeAction, savePlanAction } from '../actions';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';

type Labelled = ActivityType & { label: string };
type Option = { id: string; label: string };
type Assignee = { id: string; name: string };

const selectClass = 'h-11 rounded-xl border border-separator bg-surface px-3 text-sm';

function ErrorLine({ message }: { message: string | null }) {
  return message ? <p role="alert" className="text-sm text-danger">{message}</p> : null;
}

/** Activity types: list, then create or edit one. */
export function ActivityTypesEditor({ types, assignees }: { types: Labelled[]; assignees: Assignee[] }) {
  const t = useTranslations('chatter.settings');
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [entity, setEntity] = useState('');
  const [delayCount, setDelayCount] = useState(0);
  const [delayUnit, setDelayUnit] = useState<'days' | 'weeks'>('days');
  const [category, setCategory] = useState<'default' | 'phonecall' | 'upload_file' | 'meeting'>('default');
  const [chainingType, setChainingType] = useState<'suggest' | 'trigger'>('suggest');
  const [nextTypeId, setNextTypeId] = useState('');
  const [defaultUserId, setDefaultUserId] = useState('');
  const [requireResult, setRequireResult] = useState(false);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load(ty: Labelled) {
    setEditingId(ty.id);
    setName(ty.name);
    setEntity(ty.entity ?? '');
    setDelayCount(ty.delayCount);
    setDelayUnit(ty.delayUnit === 'weeks' ? 'weeks' : 'days');
    setCategory(ty.category as typeof category);
    setChainingType(ty.chainingType === 'trigger' ? 'trigger' : 'suggest');
    setNextTypeId(ty.nextTypeId ?? '');
    setDefaultUserId(ty.defaultUserId ?? '');
    setRequireResult(ty.requireResult);
    setActive(ty.active);
    setError(null);
  }

  function reset() {
    setEditingId(null);
    setName('');
    setEntity('');
    setDelayCount(0);
    setDelayUnit('days');
    setCategory('default');
    setChainingType('suggest');
    setNextTypeId('');
    setDefaultUserId('');
    setRequireResult(false);
    setActive(true);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveActivityTypeAction({
        id: editingId ?? undefined,
        name,
        entity: entity.trim() || null,
        icon: null,
        delayCount,
        delayUnit,
        category,
        chainingType,
        nextTypeId: nextTypeId || null,
        defaultUserId: defaultUserId || null,
        requireResult,
        active,
      });
      if (!res.ok) {
        setError(t('error'));
        return;
      }
      reset();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {types.map((ty) => (
          <li key={ty.id} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
            <span>
              {ty.label}
              {ty.entity ? ` · ${ty.entity}` : ''}
              {ty.active ? '' : ` · ${t('inactive')}`}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => load(ty)}>
              {t('edit')}
            </Button>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="type-name">{t('name')}</Label>
          <Input id="type-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="type-entity">{t('entity')}</Label>
          <Input id="type-entity" value={entity} maxLength={100} onChange={(e) => setEntity(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="type-delay">{t('delay')}</Label>
          <Input id="type-delay" type="number" min={0} max={3650} value={delayCount} onChange={(e) => setDelayCount(Number(e.target.value))} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="type-unit">{t('delayUnit')}</Label>
          <select id="type-unit" className={selectClass} value={delayUnit} onChange={(e) => setDelayUnit(e.target.value as typeof delayUnit)}>
            <option value="days">{t('days')}</option>
            <option value="weeks">{t('weeks')}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="type-category">{t('category')}</Label>
          <select id="type-category" className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
            <option value="default">{t('categoryDefault')}</option>
            <option value="phonecall">{t('categoryPhonecall')}</option>
            <option value="upload_file">{t('categoryUpload')}</option>
            <option value="meeting">{t('categoryMeeting')}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="type-chaining">{t('chaining')}</Label>
          <select id="type-chaining" className={selectClass} value={chainingType} onChange={(e) => setChainingType(e.target.value as typeof chainingType)}>
            <option value="suggest">{t('chainSuggest')}</option>
            <option value="trigger">{t('chainTrigger')}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="type-next">{t('nextType')}</Label>
          <select id="type-next" className={selectClass} value={nextTypeId} onChange={(e) => setNextTypeId(e.target.value)}>
            <option value="">{t('none')}</option>
            {types.filter((ty) => ty.id !== editingId).map((ty) => (
              <option key={ty.id} value={ty.id}>{ty.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="type-default-user">{t('defaultUser')}</Label>
          <select id="type-default-user" className={selectClass} value={defaultUserId} onChange={(e) => setDefaultUserId(e.target.value)}>
            <option value="">{t('none')}</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={requireResult} onChange={(e) => setRequireResult(e.target.checked)} />
          {t('requireResult')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          {t('active')}
        </label>
        <ErrorLine message={error} />
        <div className="flex justify-end gap-2 sm:col-span-2">
          {editingId ? (
            <Button type="button" variant="ghost" onClick={reset}>{t('cancel')}</Button>
          ) : null}
          <Button type="button" onClick={save} disabled={pending || !name.trim()}>
            {editingId ? t('saveType') : t('addType')}
          </Button>
        </div>
      </div>
    </div>
  );
}

type StepDraft = {
  activityTypeId: string;
  summary: string;
  offsetDays: number;
  responsible: 'record_owner' | 'fixed';
  userId: string;
};

/** Activity plans: list, then create or edit one with its steps. */
export function PlansEditor({
  plans,
  types,
  assignees,
}: {
  plans: PlanWithSteps[];
  types: Option[];
  assignees: Assignee[];
}) {
  const t = useTranslations('chatter.settings');
  const router = useRouter();
  const blankStep = (): StepDraft => ({
    activityTypeId: types[0]?.id ?? '',
    summary: '',
    offsetDays: 0,
    responsible: 'record_owner',
    userId: assignees[0]?.id ?? '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [entity, setEntity] = useState('crm.lead');
  const [active, setActive] = useState(true);
  const [steps, setSteps] = useState<StepDraft[]>([blankStep()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load(p: PlanWithSteps) {
    setEditingId(p.plan.id);
    setName(p.plan.name);
    setEntity(p.plan.entity);
    setActive(p.plan.active);
    setSteps(
      p.steps.map((s) => ({
        activityTypeId: s.activityTypeId,
        summary: s.summary,
        offsetDays: s.offsetDays,
        responsible: s.responsible === 'fixed' ? 'fixed' : 'record_owner',
        userId: s.userId ?? '',
      })),
    );
    setError(null);
  }

  function reset() {
    setEditingId(null);
    setName('');
    setEntity('crm.lead');
    setActive(true);
    setSteps([blankStep()]);
  }

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await savePlanAction({
        id: editingId ?? undefined,
        name,
        entity,
        active,
        steps: steps.map((s) => ({
          activityTypeId: s.activityTypeId,
          summary: s.summary,
          offsetDays: s.offsetDays,
          responsible: s.responsible,
          userId: s.responsible === 'fixed' ? s.userId : null,
        })),
      });
      if (!res.ok) {
        setError(t('error'));
        return;
      }
      reset();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {plans.map((p) => (
          <li key={p.plan.id} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
            <span>
              {p.plan.name} · {p.plan.entity} · {t('stepCount', { count: p.steps.length })}
              {p.plan.active ? '' : ` · ${t('inactive')}`}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => load(p)}>
              {t('edit')}
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3 rounded-lg border p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="plan-name">{t('planName')}</Label>
            <Input id="plan-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="plan-entity">{t('entity')}</Label>
            <Input id="plan-entity" value={entity} maxLength={100} onChange={(e) => setEntity(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            {t('active')}
          </label>
        </div>
        {steps.map((s, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 rounded-md bg-default/40 p-2 sm:grid-cols-6">
            <select aria-label={t('stepType')} className={selectClass} value={s.activityTypeId} onChange={(e) => updateStep(i, { activityTypeId: e.target.value })}>
              {types.map((ty) => (
                <option key={ty.id} value={ty.id}>{ty.label}</option>
              ))}
            </select>
            <Input aria-label={t('stepSummary')} className="sm:col-span-2" value={s.summary} maxLength={200} placeholder={t('stepSummary')} onChange={(e) => updateStep(i, { summary: e.target.value })} />
            <Input aria-label={t('offsetDays')} type="number" value={s.offsetDays} onChange={(e) => updateStep(i, { offsetDays: Number(e.target.value) })} />
            <select aria-label={t('responsible')} className={selectClass} value={s.responsible} onChange={(e) => updateStep(i, { responsible: e.target.value as StepDraft['responsible'] })}>
              <option value="record_owner">{t('recordOwner')}</option>
              <option value="fixed">{t('fixedUser')}</option>
            </select>
            <div className="flex items-center gap-2">
              {s.responsible === 'fixed' ? (
                <select aria-label={t('fixedUser')} className={`${selectClass} w-full`} value={s.userId} onChange={(e) => updateStep(i, { userId: e.target.value })}>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              ) : null}
              <Button type="button" size="sm" variant="ghost" disabled={steps.length === 1} onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))}>
                {t('removeStep')}
              </Button>
            </div>
          </div>
        ))}
        <ErrorLine message={error} />
        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setSteps((prev) => [...prev, blankStep()])}>
            {t('addStep')}
          </Button>
          <div className="flex gap-2">
            {editingId ? (
              <Button type="button" variant="ghost" onClick={reset}>{t('cancel')}</Button>
            ) : null}
            <Button type="button" onClick={save} disabled={pending || !name.trim() || !entity.trim() || steps.some((s) => !s.summary.trim() || !s.activityTypeId)}>
              {editingId ? t('savePlan') : t('addPlan')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
