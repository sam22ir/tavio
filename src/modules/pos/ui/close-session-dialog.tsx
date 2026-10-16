'use client';

import { toast } from 'sonner';
import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { formatDzd } from '@/core/money';
import { Button } from '@/ui/primitives/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/ui/primitives/dialog';
import { Input } from '@/ui/primitives/input';
import { closeSessionAct, type WireSessionReport } from '../actions';

export function CloseSessionDialog({ sessionId }: { sessionId: string }) {
  const t = useTranslations('pos');
  const router = useRouter();
  const locale = useLocale() as 'fr' | 'ar' | 'en';
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<WireSessionReport | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      const r = await closeSessionAct({ sessionId, closingCash: counted });
      if (!r.ok) {
        const text = t(r.error.message === 'INVALID_AMOUNT' ? 'errors.invalid' : 'errors.failed');
        setError(text);
        toast.error(text);
        return;
      }
      setReport(r.value);
      router.refresh();
    });
  }

  const money = (cents: string | null): string => (cents === null ? '-' : formatDzd(BigInt(cents), locale));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11">
          {t('session.close')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('session.closeTitle')}</DialogTitle>
          <DialogDescription>{t('session.closeHelp')}</DialogDescription>
        </DialogHeader>

        {report ? (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt>{t('session.expectedCash')}</dt>
            <dd className="tabular-nums">{money(report.expectedCashCents)}</dd>
            <dt>{t('session.closingCash')}</dt>
            <dd className="tabular-nums">{money(report.closingCashCents)}</dd>
            <dt>{t('session.difference')}</dt>
            <dd className="tabular-nums">{money(report.differenceCents)}</dd>
          </dl>
        ) : (
          <label className="flex flex-col gap-1 text-sm">
            {t('session.closingCash')}
            <Input inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} className="min-h-11" />
          </label>
        )}

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          {report ? (
            <Button type="button" className="min-h-11" onClick={() => window.location.reload()}>
              {t('session.done')}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)}>
                {t('session.cancel')}
              </Button>
              <Button type="button" className="min-h-11" disabled={pending || counted === ''} onClick={submit}>
                {t('session.confirmClose')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
