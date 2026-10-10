'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { formatDzd } from '@/core/money';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import { recordCashCountAction } from '../reconciliation-actions';
import { scopedKey } from './bank-statement-import';
import { messageKeyOf } from './reconciliation-dto';

/** Counts the cash (account 53). The difference with the book balance is posted to 658 or 758, flagged to verify. */
export function CashCountForm({ accountId, bookBalance, today }: { accountId: string; bookBalance: string; today: string }) {
  const t = useTranslations('accounting.reconciliation');
  const locale = useLocale() as 'fr' | 'ar' | 'en';
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const date = String(f.get('date') ?? '');
    const counted = String(f.get('counted') ?? '').trim();
    setMessage(null);
    startTransition(async () => {
      const res = await recordCashCountAction({ accountId, date, counted });
      if (!res.ok) {
        setMessage({ kind: 'error', text: t(scopedKey(messageKeyOf(res.error), 'errors.' + res.error.code.toLowerCase())) });
        return;
      }
      const noDiff = BigInt(res.value.diffCents) === BigInt(0);
      setMessage({ kind: 'ok', text: noDiff ? t('cash.noDiff') : t('cash.posted') });
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <h2 className="font-medium">{t('cash.title')}</h2>
      <p className="text-sm">
        {t('cash.book')}: <span className="font-mono">{formatDzd(BigInt(bookBalance), locale)}</span>
      </p>
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="cash-date">{t('cash.date')}</Label>
          <Input id="cash-date" name="date" type="date" defaultValue={today} required />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="cash-counted">{t('cash.counted')}</Label>
          <Input id="cash-counted" name="counted" inputMode="decimal" required />
        </div>
        <Button type="submit" className="min-h-11 self-end" disabled={pending}>{t('cash.count')}</Button>
      </form>
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${message.kind === 'error' ? 'text-destructive' : ''}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
