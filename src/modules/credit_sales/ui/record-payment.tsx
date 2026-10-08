'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { formatDzd, type Cents } from '@/core/money';
import type { Locale } from '@/core/ctx';
import { toast } from 'sonner';
import { recordPaymentAction } from '../actions/payments';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/primitives/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/primitives/select';

// 'cheque' is hidden until the form collects the cheque due date the database requires.
const METHODS = ['cash', 'ccp', 'transfer', 'cib', 'edahabia'] as const;

/** Formats integer cents as a plain DZD string that parseDzd accepts, e.g. 150050 -> "1500.50". */
function centsToInput(cents: string): string {
  const c = BigInt(cents);
  return `${c / 100n}.${(c % 100n).toString().padStart(2, '0')}`;
}

export function RecordPaymentButton({
  contractId,
  remainingCents,
  nextDueCents,
}: {
  contractId: string;
  remainingCents: string;
  /** Optional: amount of the next due installment, used as the default amount. */
  nextDueCents?: string;
}) {
  const t = useTranslations('credit');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(nextDueCents ? centsToInput(nextDueCents) : '');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('cash');
  const [reference, setReference] = useState('');
  const [isDownPayment, setIsDownPayment] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const result = await recordPaymentAction({ contractId, amount, method, reference, isDownPayment });
      if (!result.ok) {
        toast.error(result.error.code === 'VALIDATION' ? t('payment.amount') : result.error.message);
        return;
      }
      toast.success(t('payment.success', { number: result.value.receiptNumber }), {
        description: (
          <Link href={`/credit/receipts/${result.value.receiptId}`} className="underline">
            {t('receipt.title')} {result.value.receiptNumber}
          </Link>
        ),
      });
      setOpen(false);
      setReference('');
      setIsDownPayment(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t('payment.record')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('payment.record')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`pay-amount-${contractId}`}>{t('payment.amount')}</Label>
            <Input
              id={`pay-amount-${contractId}`}
              inputMode="decimal"
              dir="ltr"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              {formatDzd(BigInt(remainingCents) as Cents, locale)}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t('payment.method')}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as (typeof METHODS)[number])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(`methods.${m}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`pay-ref-${contractId}`}>{t('payment.reference')}</Label>
            <Input
              id={`pay-ref-${contractId}`}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={120}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isDownPayment}
              onChange={(e) => setIsDownPayment(e.target.checked)}
              className="size-4"
            />
            {t('payment.down_payment')}
          </label>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {t('payment.record')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
