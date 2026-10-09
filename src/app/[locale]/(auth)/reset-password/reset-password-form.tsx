'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { authClient } from '@/core/auth/client';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  if (!token) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t('errors.missing_token')}
      </p>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const newPassword = String(fd.get('password') ?? '');
    const confirm = String(fd.get('confirm') ?? '');
    setErrorKey(null);
    if (newPassword !== confirm) {
      setErrorKey('errors.mismatch');
      return;
    }
    setPending(true);
    try {
      const result = await authClient.resetPassword({ newPassword, token });
      if (result.error) {
        setErrorKey('errors.reset_failed');
        return;
      }
      setDone(true);
    } catch {
      setErrorKey('errors.reset_failed');
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="text-sm">
          {t('reset.success')}
        </p>
        <Link href={`/${locale}/login`} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {t('reset.back_to_login')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t('fields.newPassword')}</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} dir="ltr" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">{t('fields.confirm')}</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} dir="ltr" required />
      </div>
      {errorKey && (
        <p role="alert" className="text-sm text-destructive">
          {t(errorKey)}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t('reset.submitting') : t('reset.submit')}
      </Button>
    </form>
  );
}
