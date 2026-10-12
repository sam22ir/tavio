'use client';

import { toast } from 'sonner';
import Link from 'next/link';
import { useMemo, useState, useSyncExternalStore, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button, buttonVariants } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import { Textarea } from '@/ui/primitives/textarea';
import { cn } from '@/ui/lib/cn';
import { placeWebOrderAction } from '../public-actions';
import { noopSubscribe, parseCart, readCartRaw, subscribeCart, writeCart } from './cart-store';

interface CheckoutFormProps {
  slug: string;
  shopHref: string;
}

type Phase =
  | { kind: 'form' }
  | { kind: 'sending' }
  | { kind: 'done'; number: string }
  | { kind: 'error'; reason: 'rate_limited' | 'invalid' | 'generic' };

export function CheckoutForm({ slug, shopHref }: CheckoutFormProps) {
  const t = useTranslations('website');
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const raw = useSyncExternalStore(subscribeCart, () => readCartRaw(slug), () => '');
  const items = useMemo(() => parseCart(raw), [raw]);
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (items.length === 0) return;
    const form = new FormData(event.currentTarget);
    setPhase({ kind: 'sending' });
    const result = await placeWebOrderAction({
      slug,
      customerName: String(form.get('customerName') ?? ''),
      phone: String(form.get('phone') ?? ''),
      wilayaCode: String(form.get('wilayaCode') ?? ''),
      address: String(form.get('address') ?? ''),
      lines: items,
    });
    if (result.ok) {
      writeCart(slug, []);
      setPhase({ kind: 'done', number: result.value.number });
      return;
    }
    const rateLimited = result.error.details?.reason === 'RATE_LIMITED';
    const reason = rateLimited ? 'rate_limited' : result.error.code === 'VALIDATION' ? 'invalid' : 'generic';
    setPhase({ kind: 'error', reason });
    toast.error(t(`checkout.errors.${reason}`));
  }

  if (!ready) return null;

  if (phase.kind === 'done') {
    return (
      <div role="status" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t('checkout.done_title')}</h2>
        <p className="text-sm">
          {t('checkout.done_body', { number: phase.number })}
        </p>
        <Link href={shopHref} className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11 w-fit')}>
          {t('cart.continue_shopping')}
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">{t('cart.empty')}</p>
        <Link href={shopHref} className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11 w-fit')}>
          {t('cart.continue_shopping')}
        </Link>
      </div>
    );
  }

  const busy = phase.kind === 'sending';

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      <p className="text-sm text-muted">{t('checkout.cod_note')}</p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="customerName">{t('checkout.fields.customerName')}</Label>
        <Input id="customerName" name="customerName" autoComplete="name" required minLength={2} maxLength={100} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">{t('checkout.fields.phone')}</Label>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" required maxLength={30} dir="ltr" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="wilayaCode">{t('checkout.fields.wilayaCode')}</Label>
        <Input id="wilayaCode" name="wilayaCode" inputMode="numeric" pattern="0[1-9]|[1-4][0-9]|5[0-8]" placeholder="16" required maxLength={2} dir="ltr" />
        <p className="text-xs text-muted">{t('checkout.wilaya_hint')}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="address">{t('checkout.fields.address')}</Label>
        <Textarea id="address" name="address" required minLength={5} maxLength={300} />
      </div>

      {phase.kind === 'error' ? (
        <p role="alert" className="text-sm text-destructive">
          {t(`checkout.errors.${phase.reason}`)}
        </p>
      ) : null}

      <Button type="submit" disabled={busy} className="min-h-11 w-full sm:w-auto">
        {busy ? t('checkout.sending') : t('checkout.submit')}
      </Button>
    </form>
  );
}
