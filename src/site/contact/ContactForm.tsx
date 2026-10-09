'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { FieldError, Input, Label, TextArea, TextField } from '@heroui/react';
import { submitContact, type ContactState } from './actions';
import { CONTACT_TYPES, HONEYPOT_FIELD, type ContactType } from './schema';

const initial: ContactState = { status: 'idle' };

/** Contact form: server action, zod validation on the server, honeypot, success and error states. */
export function ContactForm({ defaultType = 'other' }: { defaultType?: ContactType }) {
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
    <form action={formAction} className="s-panel flex min-w-0 flex-col gap-5 p-6 md:p-8" noValidate>
      <div className="grid min-w-0 gap-5 sm:grid-cols-2">
        <label className="flex min-w-0 flex-col gap-2 sm:col-span-2">
          <span className="text-sm font-medium">{t('type.label')}</span>
          <select
            name="type"
            defaultValue={defaultType}
            className="h-12 w-full rounded-[var(--field-radius)] border border-[color:var(--field-border)] bg-[var(--field-background)] px-4 text-[color:var(--field-foreground)]"
          >
            {CONTACT_TYPES.map((value) => (
              <option key={value} value={value}>
                {t(`type.options.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <TextField name="name" isRequired isInvalid={invalid('name')} className="flex min-w-0 flex-col gap-2">
          <Label>{t('form.name')}</Label>
          <Input id="contact-name" autoComplete="name" />
          <FieldError>{t('errors.field')}</FieldError>
        </TextField>
        <TextField name="company" isInvalid={invalid('company')} className="flex min-w-0 flex-col gap-2">
          <Label>{t('form.company')}</Label>
          <Input id="contact-company" autoComplete="organization" />
          <FieldError>{t('errors.field')}</FieldError>
        </TextField>
        <TextField name="phone" isRequired isInvalid={invalid('phone')} className="flex min-w-0 flex-col gap-2">
          <Label>{t('form.phone')}</Label>
          <Input id="contact-phone" autoComplete="tel" type="tel" inputMode="tel" dir="ltr" />
          <FieldError>{t('errors.field')}</FieldError>
        </TextField>
        <TextField name="email" isRequired isInvalid={invalid('email')} className="flex min-w-0 flex-col gap-2">
          <Label>{t('form.email')}</Label>
          <Input id="contact-email" autoComplete="email" type="email" dir="ltr" />
          <FieldError>{t('errors.field')}</FieldError>
        </TextField>
        <TextField name="wilaya" isRequired isInvalid={invalid('wilaya')} className="flex min-w-0 flex-col gap-2 sm:col-span-2">
          <Label>{t('form.wilaya')}</Label>
          <Input id="contact-wilaya" autoComplete="address-level1" />
          <FieldError>{t('errors.field')}</FieldError>
        </TextField>
      </div>

      <TextField name="message" isRequired isInvalid={invalid('message')} className="flex min-w-0 flex-col gap-2">
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
        <button
          type="submit"
          disabled={pending}
          className="s-btn s-btn-dark inline-flex h-12 w-full items-center justify-center rounded-full px-7 text-base font-medium disabled:opacity-60 md:w-auto"
        >
          {pending ? t('form.sending') : t('form.submit')}
        </button>
        <p className="min-w-0 break-words text-sm text-muted-foreground">{t('form.hint')}</p>
      </div>
    </form>
  );
}
