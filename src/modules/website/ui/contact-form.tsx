'use client';

import { toast } from 'sonner';
import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import { Textarea } from '@/ui/primitives/textarea';
import { submitWebsiteContactAction } from '../public-actions';

type Phase =
  | { kind: 'form' }
  | { kind: 'sending' }
  | { kind: 'done' }
  | { kind: 'error'; reason: 'rate_limited' | 'invalid' | 'generic' };

export function ContactForm({ slug }: { slug: string }) {
  const t = useTranslations('website');
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPhase({ kind: 'sending' });
    const result = await submitWebsiteContactAction({
      slug,
      name: String(form.get('name') ?? ''),
      phone: String(form.get('phone') ?? ''),
      email: String(form.get('email') ?? ''),
      wilayaCode: String(form.get('wilayaCode') ?? ''),
      message: String(form.get('message') ?? ''),
      website: String(form.get('website') ?? ''),
    });
    if (result.ok) {
      setPhase({ kind: 'done' });
      return;
    }
    const rateLimited = result.error.details?.reason === 'RATE_LIMITED';
    const reason = rateLimited ? 'rate_limited' : result.error.code === 'VALIDATION' ? 'invalid' : 'generic';
    setPhase({ kind: 'error', reason });
    toast.error(t(`contact.errors.${reason}`));
  }

  if (phase.kind === 'done') {
    return (
      <p role="status" className="text-sm">
        {t('contact.done')}
      </p>
    );
  }

  const busy = phase.kind === 'sending';

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-name">{t('contact.fields.name')}</Label>
        <Input id="contact-name" name="name" autoComplete="name" required minLength={2} maxLength={100} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-phone">{t('contact.fields.phone')}</Label>
        <Input id="contact-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" required maxLength={30} dir="ltr" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-email">{t('contact.fields.email')}</Label>
        <Input id="contact-email" name="email" type="email" autoComplete="email" maxLength={254} dir="ltr" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-wilaya">{t('contact.fields.wilayaCode')}</Label>
        <Input id="contact-wilaya" name="wilayaCode" inputMode="numeric" pattern="0[1-9]|[1-4][0-9]|5[0-8]" placeholder="16" required maxLength={2} dir="ltr" />
        <p className="text-xs text-muted-foreground">{t('checkout.wilaya_hint')}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-message">{t('contact.fields.message')}</Label>
        <Textarea id="contact-message" name="message" required minLength={5} maxLength={2000} />
      </div>

      {/* Honeypot: hidden from people and screen readers. Bots that fill it are dropped silently. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {phase.kind === 'error' ? (
        <p role="alert" className="text-sm text-destructive">
          {t(`contact.errors.${phase.reason}`)}
        </p>
      ) : null}

      <Button type="submit" disabled={busy} className="min-h-11 w-full sm:w-auto">
        {busy ? t('checkout.sending') : t('contact.submit')}
      </Button>
    </form>
  );
}
