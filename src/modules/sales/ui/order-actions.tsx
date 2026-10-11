'use client';

import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { cancelOrderAction, confirmOrderAction, createInvoiceFromOrderAction, markOrderSentAction } from '../actions';

type Props = { id: string; state: string; invoiced: boolean; locale: string };

const BUTTON = 'min-h-11 min-w-11 rounded-md border px-4 text-sm font-medium disabled:opacity-50';

// State actions on the order detail page. Each action is a server call; the page refreshes afterwards.
export function OrderActions({ id, state, invoiced, locale }: Props) {
  const t = useTranslations('sales');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: (input: { id: string }) => Promise<{ ok: boolean; error?: { code: string; message?: string } }>, after?: (id: string) => void) =>
    startTransition(async () => {
      setError(null);
      const result = await fn({ id });
      if (!result.ok) {
        const message =
          result.error?.message === 'ORDER_HAS_DELIVERIES_OR_INVOICES'
            ? t('errors.has_deliveries')
            : result.error?.message === 'NOTHING_TO_INVOICE'
              ? t('errors.nothing_to_invoice')
              : t('errors.failed');
        setError(message);
        toast.error(message);
        return;
      }
      if (after) after(id);
      router.refresh();
    });

  const canEdit = state === 'draft' || state === 'sent';
  const canSend = state === 'draft';
  const canConfirm = state === 'draft' || state === 'sent';
  // Several invoices per order are allowed while confirmed; the service refuses when nothing is billable.
  const canInvoice = state === 'confirmed' && !invoiced;
  const canCancel = !invoiced && (state === 'draft' || state === 'sent' || state === 'confirmed');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canEdit ? (
          <Link href={`/${locale}/sales/${id}/edit`} className={`${BUTTON} inline-flex items-center`}>
            {t('actions.edit')}
          </Link>
        ) : null}
        {canSend ? (
          <button type="button" disabled={pending} className={BUTTON} onClick={() => run(markOrderSentAction)}>
            {t('actions.send')}
          </button>
        ) : null}
        {canConfirm ? (
          <button
            type="button"
            disabled={pending}
            className={`${BUTTON} bg-primary text-primary-foreground`}
            onClick={() => run(confirmOrderAction)}
          >
            {t('actions.confirm')}
          </button>
        ) : null}
        {canInvoice ? (
          <button type="button" disabled={pending} className={BUTTON} onClick={() => run(createInvoiceFromOrderAction)}>
            {t('actions.invoice')}
          </button>
        ) : null}
        {canCancel ? (
          <button type="button" disabled={pending} className={`${BUTTON} text-destructive`} onClick={() => run(cancelOrderAction)}>
            {t('actions.cancel')}
          </button>
        ) : null}
        <Link href={`/${locale}/sales/${id}/print`} className={`${BUTTON} inline-flex items-center`}>
          {t('actions.print')}
        </Link>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
