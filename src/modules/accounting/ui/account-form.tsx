'use client';

import { useActionState, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { archiveAccountButton, createAccountForm, updateAccountForm } from '../actions';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import type { FormState } from '@/core/entities/types';

export interface AccountFormValues {
  id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  reconcilable: boolean;
  archived: boolean;
}

const TYPES = ['asset', 'liability', 'equity', 'income', 'expense'] as const;

// Create (no account) or edit an account. The code is fixed once created. Archive is shown in edit mode.
export function AccountForm({ account, locale }: { account?: AccountFormValues; locale: string }) {
  const t = useTranslations('accounting');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createState, createAction] = useActionState<FormState, FormData>(createAccountForm, {});
  const [editState, editAction] = useActionState<FormState, FormData>(updateAccountForm, {});
  const [confirming, setConfirming] = useState(false);
  const state = account ? editState : createState;

  const archive = () =>
    startTransition(async () => {
      if (!account) return;
      const result = await archiveAccountButton(account.id);
      if (!result.ok) toast.error(t('errors.generic'));
      else router.push(`/${locale}/accounting/accounts`);
    });

  return (
    <div className="flex flex-col gap-4">
      <form action={account ? editAction : createAction} className="grid gap-3 sm:grid-cols-2">
        {account ? <input type="hidden" name="id" value={account.id} /> : null}
        <div className="flex flex-col gap-1">
          <Label htmlFor="acc-code">{t('fields.code')}</Label>
          <Input id="acc-code" name="code" defaultValue={account?.code ?? ''} disabled={!!account} required={!account} inputMode="numeric" className="tabular-nums" />
          {state.fieldErrors?.code ? <p className="text-sm text-destructive">{state.fieldErrors.code}</p> : null}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="acc-name">{t('fields.name')}</Label>
          <Input id="acc-name" name="name" defaultValue={account?.name ?? ''} required maxLength={160} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="acc-type">{t('fields.type')}</Label>
          <select id="acc-type" name="type" defaultValue={account?.type ?? 'asset'} className="text-sm">
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>{t(`options.type.${ty}`)}</option>
            ))}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="reconcilable" defaultChecked={account?.reconcilable ?? false} className="size-4" />
          {t('fields.reconcilable')}
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" className="min-h-11" disabled={pending || account?.archived}>
            {account ? t('form.save') : t('form.create')}
          </Button>
          {account && !account.archived ? (
            confirming ? (
              <>
                <span className="self-center text-sm">{t('form.archiveConfirm')}</span>
                <Button type="button" variant="destructive" className="min-h-11" disabled={pending} onClick={archive}>{t('form.archiveYes')}</Button>
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirming(false)}>{t('form.cancel')}</Button>
              </>
            ) : (
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirming(true)}>{t('form.archive')}</Button>
            )
          ) : null}
        </div>
      </form>
      {state.ok === false ? (
        <p role="alert" className="text-sm text-destructive">{state.message && t.has(`errors.${state.message}`) ? t(`errors.${state.message}`) : t('errors.generic')}</p>
      ) : null}
      {state.ok && !account ? <p className="text-sm">{t('form.created')}</p> : null}
      {state.ok && account ? <p className="text-sm">{t('form.saved')}</p> : null}
    </div>
  );
}
