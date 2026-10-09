'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import { Textarea } from '@/ui/primitives/textarea';
import { submitContact, type ContactState } from './actions';
import { HONEYPOT_FIELD } from './schema';

const initial: ContactState = { status: 'idle' };

/** Contact form: server action, zod validation on the server, honeypot, success and error states. */
export function ContactForm() {
  const t = useTranslations('site_company.contact');
  const [state, formAction, pending] = useActionState(submitContact, initial);

  if (state.status === 'sent') {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 md:p-8">
        <h2 className="text-xl font-semibold tracking-tight">{t('success.title')}</h2>
        <p className="leading-relaxed text-muted-foreground">{t('success.body')}</p>
      </div>
    );
  }

  const errs = state.fieldErrors ?? {};
  const fieldError = (name: string) =>
    errs[name] ? <p className="text-sm text-destructive">{t('errors.field')}</p> : null;

  return (
    <form action={formAction} className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 md:p-8" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="contact-name">{t('form.name')}</Label>
          <Input id="contact-name" name="name" autoComplete="name" required aria-invalid={!!errs.name} />
          {fieldError('name')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="contact-company">{t('form.company')}</Label>
          <Input id="contact-company" name="company" autoComplete="organization" aria-invalid={!!errs.company} />
          {fieldError('company')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="contact-phone">{t('form.phone')}</Label>
          <Input id="contact-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" dir="ltr" required aria-invalid={!!errs.phone} />
          {fieldError('phone')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="contact-email">{t('form.email')}</Label>
          <Input id="contact-email" name="email" type="email" autoComplete="email" dir="ltr" required aria-invalid={!!errs.email} />
          {fieldError('email')}
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="contact-wilaya">{t('form.wilaya')}</Label>
          <Input id="contact-wilaya" name="wilaya" autoComplete="address-level1" required aria-invalid={!!errs.wilaya} />
          {fieldError('wilaya')}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="contact-message">{t('form.message')}</Label>
        <Textarea id="contact-message" name="message" rows={5} required aria-invalid={!!errs.message} />
        {fieldError('message')}
      </div>

      {/* Honeypot: hidden from people and assistive tech, bots fill it in. */}
      <div className="hidden" aria-hidden="true">
        <label>
          {t('form.website')}
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.status === 'invalid' ? <p role="alert" className="text-sm text-destructive">{t('errors.invalid')}</p> : null}
      {state.status === 'rate_limited' ? <p role="alert" className="text-sm text-destructive">{t('errors.rateLimited')}</p> : null}
      {state.status === 'error' ? <p role="alert" className="text-sm text-destructive">{t('errors.failed')}</p> : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? t('form.sending') : t('form.submit')}
        </Button>
        <p className="text-sm text-muted-foreground">{t('form.hint')}</p>
      </div>
    </form>
  );
}
