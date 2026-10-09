'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { authClient } from '@/core/auth/client';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') ?? '');
    setPending(true);
    try {
      // Always show the same message, whether or not the account exists (no enumeration).
      await authClient.requestPasswordReset({ email, redirectTo: `/${locale}/reset-password` });
    } catch {
      // Ignored on purpose: the response must not reveal anything about the account.
    } finally {
      setPending(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <p role="status" className="text-sm">
        {t('forgot.sent')}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t('fields.email')}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" dir="ltr" required />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t('forgot.submitting') : t('forgot.submit')}
      </Button>
    </form>
  );
}
