'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { saveStampSettingsAction, setTaxRegimeAction } from '@/modules/l10n_dz/actions';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';

const SELECT_CLASS =
  'h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:h-9';
const METHODS = ['cash', 'ccp', 'transfer', 'cib', 'edahabia', 'cheque'] as const;
const SLOTS = 6;

export function RegimeForm({ initial }: { initial: 'reel' | 'ifu' }) {
  const t = useTranslations('l10n');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [regime, setRegime] = useState<'reel' | 'ifu'>(initial);

  function onSave() {
    start(async () => {
      const r = await setTaxRegimeAction({ regime });
      if (!r.ok) {
        toast.error(t('taxes.error'));
        return;
      }
      toast.success(t('regime.saved'));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t('regime.help')}</p>
      <div className="flex flex-col gap-2 sm:max-w-sm">
        <Label htmlFor="tax-regime">{t('regime.label')}</Label>
        <select id="tax-regime" className={SELECT_CLASS} value={regime} onChange={(e) => setRegime(e.target.value as 'reel' | 'ifu')}>
          <option value="reel">{t('regime.reel')}</option>
          <option value="ifu">{t('regime.ifu')}</option>
        </select>
      </div>
      <div>
        <Button type="button" onClick={onSave} disabled={pending} className="min-h-11 md:min-h-9">
          {t('regime.save')}
        </Button>
      </div>
    </div>
  );
}

export interface StampRowView {
  upTo: string; // empty = no upper bound
  mode: 'fixed' | 'rate';
  value: string; // DA for fixed, percent for rate
}

export function StampSettingsForm({ methods, rows }: { methods: string[]; rows: StampRowView[] }) {
  const t = useTranslations('l10n');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string[]>(methods);
  const slots: StampRowView[] = [...rows, ...Array.from({ length: SLOTS }, () => ({ upTo: '', mode: 'fixed' as const, value: '' }))].slice(0, SLOTS);
  const [draft, setDraft] = useState<StampRowView[]>(slots);

  function update(i: number, patch: Partial<StampRowView>) {
    setDraft((d) => d.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function onSave() {
    const filled = draft.filter((r) => r.upTo.trim() !== '' || r.value.trim() !== '');
    const payload = {
      methods: selected,
      tiers: filled.map((r) => ({
        upToDa: r.upTo.trim() === '' ? null : Number(r.upTo),
        mode: r.mode,
        fixedDa: r.mode === 'fixed' ? r.value.trim() : '0',
        ratePercent: r.mode === 'rate' ? r.value.trim() : '0',
      })),
    };
    start(async () => {
      const r = await saveStampSettingsAction(payload);
      if (!r.ok) {
        toast.error(t('taxes.error'));
        return;
      }
      toast.success(t('stamp.saved'));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('stamp.help')}</p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t('stamp.methods')}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {METHODS.map((m) => (
            <label key={m} className="flex min-h-11 items-center gap-2 text-sm md:min-h-9">
              <input
                type="checkbox"
                className="size-4"
                checked={selected.includes(m)}
                onChange={(e) =>
                  setSelected((s) => (e.target.checked ? [...s, m] : s.filter((x) => x !== m)))
                }
              />
              {t(`methods.${m}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t('stamp.tiers')}</p>
        <p className="text-xs text-muted-foreground">{t('stamp.tiers_help')}</p>
        {draft.map((row, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_9rem_1fr]">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`stamp-up-${i}`} className="text-xs">{t('stamp.up_to')}</Label>
              <Input id={`stamp-up-${i}`} inputMode="numeric" value={row.upTo} placeholder={t('stamp.unbounded')} onChange={(e) => update(i, { upTo: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`stamp-mode-${i}`} className="text-xs">{t('stamp.mode')}</Label>
              <select id={`stamp-mode-${i}`} className={SELECT_CLASS} value={row.mode} onChange={(e) => update(i, { mode: e.target.value as 'fixed' | 'rate' })}>
                <option value="fixed">{t('stamp.mode_fixed')}</option>
                <option value="rate">{t('stamp.mode_rate')}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`stamp-value-${i}`} className="text-xs">{row.mode === 'fixed' ? t('stamp.value_fixed') : t('stamp.value_rate')}</Label>
              <Input id={`stamp-value-${i}`} inputMode="decimal" value={row.value} onChange={(e) => update(i, { value: e.target.value })} />
            </div>
          </div>
        ))}
      </div>
      <div>
        <Button type="button" onClick={onSave} disabled={pending} className="min-h-11 md:min-h-9">
          {t('stamp.save')}
        </Button>
      </div>
    </div>
  );
}
