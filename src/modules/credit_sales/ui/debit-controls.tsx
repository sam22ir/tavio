'use client';
import { createContext, useContext, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import {
  cancelBatchAction,
  closeBatchAction,
  createBatchAction,
  deactivateMandateAction,
  dismissItemAction,
  importResultsAction,
  markRemainingPaidAction,
  saveMandateAction,
  settleItemAction,
} from '../actions/debits';

type Translate = ReturnType<typeof useTranslations>;

/** Known error codes are translated; anything else is shown as received. */
function errorText(t: Translate, error: { code: string; message: string }): string {
  const key = `debits.errors.${error.message}`;
  return t.has(key) ? t(key) : t.has(`debits.errors.${error.code}`) ? t(`debits.errors.${error.code}`) : error.message;
}

const today = () => new Date().toISOString().slice(0, 10);

// One debit date for the whole batch screen: the toolbar edits it, and every row action and the bulk action use it,
// so receipts and collection figures carry the day the money moved, not the day someone typed the result in.
const DebitDateContext = createContext<{ date: string; setDate: (d: string) => void }>({ date: '', setDate: () => {} });

export function DebitDateProvider({ defaultDate, children }: { defaultDate: string; children: React.ReactNode }) {
  const [date, setDate] = useState(defaultDate);
  return <DebitDateContext.Provider value={{ date, setDate }}>{children}</DebitDateContext.Provider>;
}

export function NewBatchForm({ defaultMonth }: { defaultMonth: string }) {
  const t = useTranslations('credit');
  const router = useRouter();
  const [month, setMonth] = useState(defaultMonth);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    start(async () => {
      const r = await createBatchAction({ month });
      if (!r.ok) return void toast.error(errorText(t, r.error));
      toast.success(t('debits.created', { number: r.value.number, count: r.value.items }));
      router.push(`/credit/debits/${r.value.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="debit-month">{t('debits.month')}</Label>
        <Input id="debit-month" type="month" dir="ltr" value={month} onChange={(e) => setMonth(e.target.value)} required />
      </div>
      <Button type="submit" disabled={pending || !month}>
        {t('debits.create')}
      </Button>
    </form>
  );
}

export function BatchToolbar({ batchId, status, hasPending }: { batchId: string; status: string; hasPending: boolean }) {
  const t = useTranslations('credit');
  const router = useRouter();
  const { date: paidOn, setDate: setPaidOn } = useContext(DebitDateContext);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const open = status === 'draft' || status === 'exported';

  function run(fn: () => Promise<void>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  function markAll() {
    run(async () => {
      const r = await markRemainingPaidAction({ batchId, settledOn: paidOn });
      if (!r.ok) return void toast.error(errorText(t, r.error));
      toast.success(t('debits.markedAll', { paid: r.value.paid, review: r.value.needsReview }));
    });
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    run(async () => {
      const text = await file.text();
      const r = await importResultsAction({ batchId, text });
      if (!r.ok) return void toast.error(errorText(t, r.error));
      const s = r.value;
      toast.success(
        t('debits.importDone', {
          paid: s.paid,
          rejected: s.rejected,
          review: s.needsReview,
          skipped: s.skipped,
          unknown: s.unknown.length,
          errors: s.errors.length,
        }),
      );
    });
  }

  function simple(action: () => Promise<{ ok: boolean; error?: { code: string; message: string } }>, done: string) {
    run(async () => {
      const r = await action();
      if (!r.ok && r.error) return void toast.error(errorText(t, r.error));
      toast.success(done);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {status !== 'cancelled' ? (
        <Button asChild variant="outline">
          <a href={`/credit/debits/${batchId}/export`}>{t('debits.export')}</a>
        </Button>
      ) : null}
      {open ? (
        <>
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="debit-paid-on">{t('debits.paidOn')}</Label>
              <Input id="debit-paid-on" type="date" dir="ltr" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </div>
            <Button type="button" disabled={pending || !hasPending || !paidOn} onClick={markAll}>
              {t('debits.markAllPaid')}
            </Button>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="sr-only" aria-label={t('debits.import')} onChange={onFile} />
          <Button type="button" variant="outline" disabled={pending} onClick={() => fileRef.current?.click()}>
            {t('debits.import')}
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => simple(() => closeBatchAction({ batchId }), t('debits.closed'))}>
            {t('debits.close')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              if (window.confirm(t('debits.cancelConfirm'))) simple(() => cancelBatchAction({ batchId }), t('debits.cancelled'));
            }}
          >
            {t('debits.cancel')}
          </Button>
        </>
      ) : null}
    </div>
  );
}

export function ItemActions({ itemId, status }: { itemId: string; status: string }) {
  const t = useTranslations('credit');
  const router = useRouter();
  const { date: settledOn } = useContext(DebitDateContext);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();
  if (status !== 'pending' && status !== 'needs_review') return null;

  function settle(outcome: 'paid' | 'rejected') {
    start(async () => {
      const r = await settleItemAction({ itemId, outcome, settledOn: settledOn || undefined, reason: outcome === 'rejected' ? reason : undefined });
      if (!r.ok) return void toast.error(errorText(t, r.error));
      toast.success(t('debits.settled'));
      setRejecting(false);
      router.refresh();
    });
  }

  function dismiss() {
    start(async () => {
      const r = await dismissItemAction({ itemId });
      if (!r.ok) return void toast.error(errorText(t, r.error));
      toast.success(t('debits.dismissed'));
      router.refresh();
    });
  }

  if (rejecting) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={t('debits.rejectReason')}
          placeholder={t('debits.rejectReason')}
          value={reason}
          maxLength={200}
          onChange={(e) => setReason(e.target.value)}
          className="min-w-40"
        />
        <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={() => settle('rejected')}>
          {t('debits.markRejected')}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setRejecting(false)}>
          ×
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" disabled={pending} onClick={() => settle('paid')}>
        {t('debits.markPaid')}
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setRejecting(true)}>
        {t('debits.markRejected')}
      </Button>
      {status === 'needs_review' ? (
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={dismiss}>
          {t('debits.dismiss')}
        </Button>
      ) : null}
    </div>
  );
}

export function MandateForm({
  contractId,
  mandate,
}: {
  contractId: string;
  mandate: { ccpAccount: string; signedOn: string; active: boolean } | null;
}) {
  const t = useTranslations('credit');
  const router = useRouter();
  const [account, setAccount] = useState(mandate?.ccpAccount ?? '');
  const [signedOn, setSignedOn] = useState(mandate?.signedOn ?? today());
  const [pending, start] = useTransition();

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    start(async () => {
      const r = await saveMandateAction({ contractId, ccpAccount: account, signedOn });
      if (!r.ok) {
        toast.error(r.error.message === 'INVALID_CCP_ACCOUNT' ? t('mandate.invalidAccount') : errorText(t, r.error));
        return;
      }
      toast.success(t('mandate.saved'));
      router.refresh();
    });
  }

  function deactivate() {
    start(async () => {
      const r = await deactivateMandateAction({ contractId });
      if (!r.ok) return void toast.error(errorText(t, r.error));
      toast.success(t('mandate.deactivated'));
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`ccp-${contractId}`}>{t('mandate.account')}</Label>
        <Input
          id={`ccp-${contractId}`}
          dir="ltr"
          inputMode="numeric"
          autoComplete="off"
          value={account}
          maxLength={40}
          onChange={(e) => setAccount(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`ccp-signed-${contractId}`}>{t('mandate.signedOn')}</Label>
        <Input id={`ccp-signed-${contractId}`} type="date" dir="ltr" value={signedOn} onChange={(e) => setSignedOn(e.target.value)} required />
      </div>
      <Button type="submit" disabled={pending}>
        {t('mandate.save')}
      </Button>
      {mandate?.active ? (
        <Button type="button" variant="outline" disabled={pending} onClick={deactivate}>
          {t('mandate.deactivate')}
        </Button>
      ) : null}
    </form>
  );
}
