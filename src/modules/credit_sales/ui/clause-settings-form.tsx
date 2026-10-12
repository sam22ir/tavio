'use client';

import { useState, useTransition, type ChangeEvent, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import { Textarea } from '@/ui/primitives/textarea';
import { saveContractSettingsForm } from '../actions/clauses';

export interface ClauseSettingsView {
  clausesFr: string;
  clausesAr: string;
  city: string;
  latePenaltyRate: string;
  guarantorRequiredAboveDzd: string;
}

interface Props {
  initial: ClauseSettingsView;
  defaults: { fr: string; ar: string };
  variables: readonly string[];
}

/** Company contract clauses (fr and ar), penalty, city and the guarantor threshold. Blank text uses the built-in default. */
export function ClauseSettingsForm({ initial, defaults, variables }: Props) {
  const t = useTranslations('credit.clauses');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState(initial);

  const set = (key: keyof ClauseSettingsView) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveContractSettingsForm({
        clausesFr: values.clausesFr.trim() || null,
        clausesAr: values.clausesAr.trim() || null,
        city: values.city.trim() || null,
        latePenaltyRate: values.latePenaltyRate.trim() || null,
        guarantorRequiredAboveDzd: values.guarantorRequiredAboveDzd.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(t('saved'));
      router.refresh();
    });
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={save}>
      <section className="flex flex-wrap gap-2 text-sm">
        <span className="font-medium">{t('variables')}:</span>
        {variables.map((name) => (
          <code key={name} className="rounded border px-1.5 py-0.5 text-xs" dir="ltr">{`{${name}}`}</code>
        ))}
      </section>

      <div className="flex flex-col gap-2">
        <Label htmlFor="clauses-fr">{t('fr')}</Label>
        <Textarea id="clauses-fr" rows={18} dir="ltr" value={values.clausesFr} placeholder={defaults.fr}
          onChange={set('clausesFr')} />
        <p className="text-xs text-muted">{t('defaultHint')}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="clauses-ar">{t('ar')}</Label>
        <Textarea id="clauses-ar" rows={18} dir="rtl" value={values.clausesAr} placeholder={defaults.ar}
          onChange={set('clausesAr')} />
        <p className="text-xs text-muted">{t('defaultHint')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="clauses-city">{t('city')}</Label>
          <Input id="clauses-city" value={values.city} onChange={set('city')} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="clauses-penalty">{t('latePenalty')}</Label>
          <Input id="clauses-penalty" inputMode="decimal" dir="ltr" value={values.latePenaltyRate}
            placeholder="2.5" onChange={set('latePenaltyRate')} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="clauses-guarantor">{t('guarantorThreshold')}</Label>
          <Input id="clauses-guarantor" inputMode="decimal" dir="ltr" value={values.guarantorRequiredAboveDzd}
            placeholder="50000.00" onChange={set('guarantorRequiredAboveDzd')} />
          <p className="text-xs text-muted">{t('guarantorThresholdHelp')}</p>
        </div>
      </div>

      <div>
        <Button type="submit" disabled={pending} className="min-h-11">{t('save')}</Button>
      </div>
    </form>
  );
}
