'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, FieldError, Input, Label, TextArea, TextField } from '@heroui/react';
import { submitContact, type ContactState } from './actions';
import { HONEYPOT_FIELD } from './schema';

const initial: ContactState = { status: 'idle' };

/** Contact form: server action, zod validation on the server, honeypot, success and error states. */
export function ContactForm() {
  const t = useTranslations('site_company.contact');
  const [state, formAction, pending] = useActionState(submitContact, initial);

  if (state.status === 'sent') {
    return (
      <div role="status" className="s-panel flex flex-col gap-3 p-6 md:p-8">
        <h2 className="text-xl font-semibold tracking-tight">{t('success.title')}</h2>
        <p className="leading-relaxed text-muted-foreground">{t('success.body')}</p>
      </div>
    );
  }

  const errs = state.fieldErrors ?? {};
  const invalid = (name: string) => Boolean(errs[name]);

  return (
    <form action={formAction} className="s-panel flex flex-col gap-5 p-6 md:p-8" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="name" isRequired isInvalid={invalid('name')} className="flex flex-col gap-2">
          <Label>{t('form.name')}</Label>
          <Input id="contact-name" autoComplete="name" />
          <FieldError>{t('errors.field')}</FieldError>
        </TextField>
        <TextField name="company" isRequired isInvalid={invalid('company')} className="flex flex-col gap-2">
          <Label>{t('form.company')}</Label>
          <Input id="contact-company" autoComplete="organization" />
          <FieldError>{t('errors.field')}</FieldError>
        </TextField>
        <TextField name="phone" isRequired isInvalid={invalid('phone')} className="flex flex-col gap-2">
          <Label>{t('form.phone')}</Label>
          <Input id="contact-phone" autoComplete="tel" type="tel" inputMode="tel" dir="ltr" />
          <FieldError>{t('errors.field')}</FieldError>
        </TextField>
        <TextField name="email" isRequired isInvalid={invalid('email')} className="flex flex-col gap-2">
          <Label>{t('form.email')}</Label>
          <Input id="contact-email" autoComplete="email" type="email" dir="ltr" />
          <FieldError>{t('errors.field')}</FieldError>
        </TextField>
        <TextField name="wilaya" isRequired isInvalid={invalid('wilaya')} className="flex flex-col gap-2 sm:col-span-2">
          <Label>{t('form.wilaya')}</Label>
          <Input id="contact-wilaya" autoComplete="address-level1" />
          <FieldError>{t('errors.field')}</FieldError>
        </TextField>
      </div>

      <TextField name="message" isRequired isInvalid={invalid('message')} className="flex flex-col gap-2">
        <Label>{t('form.message')}</Label>
        <TextArea id="contact-message" rows={5} />
        <FieldError>{t('errors.field')}</FieldError>
      </TextField>

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
        <Button type="submit" size="lg" isDisabled={pending}>
          {pending ? t('form.sending') : t('form.submit')}
        </Button>
        <p className="text-sm text-muted-foreground">{t('form.hint')}</p>
      </div>
    </form>
  );
}
