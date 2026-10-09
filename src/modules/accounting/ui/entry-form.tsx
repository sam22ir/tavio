'use client';

import { useActionState, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createManualEntryForm } from '../actions';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import type { FormState } from '@/core/entities/types';

interface AccountOption { code: string; name: string }
interface JournalOption { code: string; name: string }
interface LineState { key: number; accountCode: string; label: string; debit: string; credit: string }

const EMPTY_LINE = (key: number): LineState => ({ key, accountCode: '', label: '', debit: '', credit: '' });
const initial: FormState = {};

// Manual journal entry. Lines are posted as JSON in a hidden field; the server checks the balance again.
export function ManualEntryForm({ accounts, journals }: { accounts: AccountOption[]; journals: JournalOption[] }) {
  const t = useTranslations('accounting');
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(createManualEntryForm, initial);
  const [lines, setLines] = useState<LineState[]>([EMPTY_LINE(1), EMPTY_LINE(2)]);
  const [nextKey, setNextKey] = useState(3);

  const update = (key: number, patch: Partial<LineState>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <form action={formAction} className="flex flex-col gap-4" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="date">{t('fields.date')}</Label>
          <Input id="date" name="date" type="date" required />
          {state.fieldErrors?.date ? <p className="text-sm text-destructive">{state.fieldErrors.date}</p> : null}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="journalCode">{t('fields.journal')}</Label>
          <select id="journalCode" name="journalCode" required className="h-9 rounded-md border bg-background px-3 text-sm">
            {journals.map((j) => (
              <option key={j.code} value={j.code}>{`${j.code} · ${j.name}`}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ref">{t('fields.ref')}</Label>
          <Input id="ref" name="ref" maxLength={120} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {lines.map((line, index) => (
          <div key={line.key} className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <select
              aria-label={t('fields.account')}
              value={line.accountCode}
              onChange={(e) => update(line.key, { accountCode: e.target.value })}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">{t('form.pickAccount')}</option>
              {accounts.map((a) => (
                <option key={a.code} value={a.code}>{`${a.code} · ${a.name}`}</option>
              ))}
            </select>
            <Input
              aria-label={t('fields.label')}
              value={line.label}
              onChange={(e) => update(line.key, { label: e.target.value })}
            />
            <Input
              aria-label={t('fields.debit')}
              inputMode="decimal"
              className="tabular-nums"
              value={line.debit}
              onChange={(e) => update(line.key, { debit: e.target.value, credit: e.target.value ? '' : line.credit })}
            />
            <Input
              aria-label={t('fields.credit')}
              inputMode="decimal"
              className="tabular-nums"
              value={line.credit}
              onChange={(e) => update(line.key, { credit: e.target.value, debit: e.target.value ? '' : line.debit })}
            />
            <Button
              type="button"
              variant="ghost"
              disabled={lines.length <= 2}
              onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
              aria-label={`${t('form.removeLine')} ${index + 1}`}
            >
              ×
            </Button>
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLines((prev) => [...prev, EMPTY_LINE(nextKey)]);
              setNextKey((k) => k + 1);
            }}
          >
            {t('form.addLine')}
          </Button>
        </div>
      </div>

      <input
        type="hidden"
        name="linesJson"
        value={JSON.stringify(
          lines.map((l) => ({ accountCode: l.accountCode, label: l.label, debit: l.debit, credit: l.credit })),
        )}
      />

      {state.ok === false ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message && t.has(`errors.${state.message}`) ? t(`errors.${state.message}`) : t('errors.generic')}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending}>{t('form.post')}</Button>
      </div>
    </form>
  );
}
