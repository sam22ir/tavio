'use client';

import { useActionState, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useFormErrorToast } from '@/ui/feedback/use-form-error-toast';
import { deleteDraftButton, postDraftButton, saveDraftForm } from '../actions';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import { formatDzd, parseDzd } from '@/core/money';
import type { FormState } from '@/core/entities/types';

interface AccountOption { code: string; name: string }
interface JournalOption { code: string; name: string }
export interface DraftLineValue { key: number; accountCode: string; label: string; debit: string; credit: string }
export interface DraftInitial {
  id: string;
  journalCode: string;
  date: string;
  ref: string;
  lines: DraftLineValue[];
}

const EMPTY_LINE = (key: number): DraftLineValue => ({ key, accountCode: '', label: '', debit: '', credit: '' });
const initial: FormState = {};

// Manual entry as a draft: lines editor with a live balance. Save keeps it as a draft. Post checks the balance on the server.
// Posted entries are never edited here; use Contrepasser on the detail page.
export function DraftEntryForm({
  accounts,
  journals,
  draft,
}: {
  accounts: AccountOption[];
  journals: JournalOption[];
  draft?: DraftInitial;
}) {
  const t = useTranslations('accounting');
  const locale = useLocale();
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveDraftForm, initial);
  useFormErrorToast(state, state.ok === false ? (state.message && t.has(`errors.${state.message}`) ? t(`errors.${state.message}`) : t('errors.generic')) : '');
  const [lines, setLines] = useState<DraftLineValue[]>(draft?.lines.length ? draft.lines : [EMPTY_LINE(1), EMPTY_LINE(2)]);
  const [nextKey, setNextKey] = useState(lines.length + 1);
  const [busy, startTransition] = useTransition();

  const update = (key: number, patch: Partial<DraftLineValue>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // Live totals in cents. An unparsable amount counts as invalid and blocks posting.
  let totalDebit = BigInt(0);
  let totalCredit = BigInt(0);
  let invalid = false;
  for (const l of lines) {
    const d = l.debit ? parseDzd(l.debit) : BigInt(0);
    const c = l.credit ? parseDzd(l.credit) : BigInt(0);
    if (d === null || c === null) invalid = true;
    else {
      totalDebit += d;
      totalCredit += c;
    }
  }
  const balanced = !invalid && totalDebit === totalCredit && totalDebit > BigInt(0);
  const fmt = (c: bigint) => formatDzd(c, locale as 'fr' | 'ar' | 'en');

  const post = () =>
    startTransition(async () => {
      if (!draft) return;
      const result = await postDraftButton(draft.id);
      if (!result.ok) toast.error(result.message && t.has(`errors.${result.message}`) ? t(`errors.${result.message}`) : t('errors.generic'));
      else {
        toast.success(t('form.posted'));
        router.refresh();
      }
    });

  const remove = () =>
    startTransition(async () => {
      if (!draft) return;
      const result = await deleteDraftButton(draft.id);
      if (!result.ok) toast.error(t('errors.generic'));
      else router.push(`/${locale}/accounting/entries`);
    });

  return (
    <form action={formAction} className="flex flex-col gap-4" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {draft ? <input type="hidden" name="id" value={draft.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="date">{t('fields.date')}</Label>
          <Input id="date" name="date" type="date" required defaultValue={draft?.date ?? ''} />
          {state.fieldErrors?.date ? <p className="text-sm text-danger">{state.fieldErrors.date}</p> : null}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="journalCode">{t('fields.journal')}</Label>
          <select id="journalCode" name="journalCode" required defaultValue={draft?.journalCode ?? 'OD'} className="text-sm">
            {journals.map((j) => (
              <option key={j.code} value={j.code}>{`${j.code} · ${j.name}`}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ref">{t('fields.ref')}</Label>
          <Input id="ref" name="ref" maxLength={120} defaultValue={draft?.ref ?? ''} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {lines.map((line, index) => (
          <div key={line.key} className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <select
              aria-label={t('fields.account')}
              value={line.accountCode}
              onChange={(e) => update(line.key, { accountCode: e.target.value })}
              className="text-sm"
            >
              <option value="">{t('form.pickAccount')}</option>
              {accounts.map((a) => (
                <option key={a.code} value={a.code}>{`${a.code} · ${a.name}`}</option>
              ))}
            </select>
            <Input aria-label={t('fields.label')} value={line.label} onChange={(e) => update(line.key, { label: e.target.value })} />
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
              className="min-h-11 min-w-11"
              disabled={lines.length <= 2}
              onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
              aria-label={`${t('form.removeLine')} ${index + 1}`}
            >
              ×
            </Button>
          </div>
        ))}
        <div>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => { setLines((prev) => [...prev, EMPTY_LINE(nextKey)]); setNextKey((k) => k + 1); }}>
            {t('form.addLine')}
          </Button>
        </div>
      </div>

      <p role="status" className={`text-sm tabular-nums ${balanced ? '' : 'text-danger'}`}>
        {t('form.totals', { debit: fmt(totalDebit), credit: fmt(totalCredit) })} · {balanced ? t('form.balancedOk') : t('form.notBalanced')}
      </p>

      <input type="hidden" name="linesJson" value={JSON.stringify(lines.map((l) => ({ accountCode: l.accountCode, label: l.label, debit: l.debit, credit: l.credit })))} />

      {state.ok === false ? (
        <p role="alert" className="text-sm text-danger">{state.message && t.has(`errors.${state.message}`) ? t(`errors.${state.message}`) : t('errors.generic')}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant={draft ? 'outline' : 'default'} className="min-h-11" disabled={pending || busy}>
          {t('form.saveDraft')}
        </Button>
        {draft ? (
          <>
            <Button type="button" className="min-h-11" disabled={busy || !balanced} onClick={post}>{t('form.post')}</Button>
            <Button type="button" variant="destructive" className="min-h-11" disabled={busy} onClick={remove}>{t('form.deleteDraft')}</Button>
          </>
        ) : null}
      </div>
    </form>
  );
}
