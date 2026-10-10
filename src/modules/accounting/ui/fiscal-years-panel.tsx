'use client';

import { useActionState, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { closeFiscalYearButton, createFiscalYearForm, setLockDateForm } from '../actions';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import type { FormState } from '@/core/entities/types';

export interface FiscalYearView {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  state: 'open' | 'closed';
}

// Settings → Exercices: list, create, close (with confirmation) and the company lock date.
export function FiscalYearsPanel({ years, lockDate }: { years: FiscalYearView[]; lockDate: string | null }) {
  const t = useTranslations('accounting.fiscalYears');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createState, createAction, creating] = useActionState<FormState, FormData>(createFiscalYearForm, {});
  const [lockState, lockAction, locking] = useActionState<FormState, FormData>(setLockDateForm, {});
  const [confirming, setConfirming] = useState<string | null>(null);

  const closeYear = (id: string) =>
    startTransition(async () => {
      const result = await closeFiscalYearButton(id);
      if (!result.ok) toast.error(t('errors.generic'));
      else toast.success(t('closed'));
      setConfirming(null);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t('list')}</h2>
        <ul className="flex flex-col gap-2">
          {years.length === 0 ? <li className="text-sm text-muted-foreground">{t('empty')}</li> : null}
          {years.map((y) => (
            <li key={y.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
              <span className="font-medium">{y.name}</span>
              <span className="text-sm tabular-nums">{y.startDate} → {y.endDate}</span>
              <span className="text-sm">{t(`state.${y.state}`)}</span>
              {y.state === 'open' ? (
                confirming === y.id ? (
                  <span className="flex items-center gap-2">
                    <span className="text-sm">{t('closeConfirm')}</span>
                    <Button size="sm" disabled={pending} onClick={() => closeYear(y.id)}>{t('closeYes')}</Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirming(null)}>{t('closeNo')}</Button>
                  </span>
                ) : (
                  <Button size="sm" variant="outline" className="min-h-11 ms-auto" onClick={() => setConfirming(y.id)}>
                    {t('close')}
                  </Button>
                )
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t('create')}</h2>
        <form action={createAction} className="grid gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="fy-name">{t('name')}</Label>
            <Input id="fy-name" name="name" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="fy-start">{t('start')}</Label>
            <Input id="fy-start" name="startDate" type="date" required />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="fy-end">{t('end')}</Label>
            <Input id="fy-end" name="endDate" type="date" required />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={creating} className="min-h-11">{t('createSubmit')}</Button>
          </div>
        </form>
        {createState.ok === false ? <p role="alert" className="text-sm text-destructive">{t('errors.generic')}</p> : null}
        {createState.ok ? <p className="text-sm">{t('created')}</p> : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t('lock')}</h2>
        <p className="text-sm text-muted-foreground">{t('lockHelp')}</p>
        <form action={lockAction} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="lock-date">{t('lockDate')}</Label>
            <Input id="lock-date" name="lockDate" type="date" defaultValue={lockDate ?? ''} />
          </div>
          <Button type="submit" disabled={locking} className="min-h-11">{t('lockSubmit')}</Button>
        </form>
        {lockState.ok === false ? <p role="alert" className="text-sm text-destructive">{t('errors.generic')}</p> : null}
      </section>
    </div>
  );
}
