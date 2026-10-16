'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { launchPlanAction } from '../actions';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';

/** Launches an activity plan on this record. Replaces the open activities of earlier runs when asked. */
export function LaunchPlanForm({
  entity,
  recordId,
  currentUserId,
  assignees,
  plans,
}: {
  entity: string;
  recordId: string;
  currentUserId: string;
  assignees: { id: string; name: string }[];
  plans: { id: string; name: string }[];
}) {
  const t = useTranslations('chatter.plan');
  const router = useRouter();
  const [planId, setPlanId] = useState(plans[0]?.id ?? '');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [ownerId, setOwnerId] = useState(currentUserId);
  const [replaceOpen, setReplaceOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await launchPlanAction({ planId, entity, recordId, startDate, ownerId, replaceOpen });
      if (!res.ok) {
        setError(t('error'));
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-3">
      <h3 className="font-medium">{t('title')}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="plan-select">{t('plan')}</Label>
          <select
            id="plan-select"
            className="h-11 rounded-xl border border-separator bg-surface px-3 text-sm"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="plan-start">{t('startDate')}</Label>
          <Input id="plan-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="plan-owner">{t('owner')}</Label>
          <select
            id="plan-owner"
            className="h-11 rounded-xl border border-separator bg-surface px-3 text-sm"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
          >
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" checked={replaceOpen} onChange={(e) => setReplaceOpen(e.target.checked)} />
          {t('replaceOpen')}
        </label>
      </div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="button" onClick={submit} disabled={pending || !planId || !startDate}>
          {t('launch')}
        </Button>
      </div>
    </section>
  );
}
