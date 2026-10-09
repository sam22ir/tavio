'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { authClient } from '@/core/auth/client';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';

export type AuthMode = 'login' | 'signup';

/** Only same-site relative paths (for example the invite page) are honoured after sign-in. */
function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  return value;
}

const USER_EXISTS_CODES = new Set(['USER_ALREADY_EXISTS', 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL']);

function errorKeyFor(mode: AuthMode, status: number | undefined, code: string | undefined): string {
  if (mode === 'login' && (status === 400 || status === 401)) return 'errors.invalid_credentials';
  if (mode === 'signup' && code && USER_EXISTS_CODES.has(code)) return 'errors.email_taken';
  return 'errors.generic';
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const email = String(fd.get('email') ?? '');
    const password = String(fd.get('password') ?? '');
    setPending(true);
    setErrorKey(null);
    try {
      const result =
        mode === 'login'
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({ name: String(fd.get('name') ?? ''), email, password });
      if (result.error) {
        setErrorKey(errorKeyFor(mode, result.error.status, result.error.code));
        return;
      }
      router.push(safeNext(new URLSearchParams(window.location.search).get('next')) ?? `/${locale}/dashboard`);
    } catch {
      setErrorKey('errors.generic');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate={false}>
      {mode === 'signup' && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">{t('fields.name')}</Label>
          <Input id="name" name="name" type="text" autoComplete="name" required />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t('fields.email')}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" dir="ltr" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t('fields.password')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={8}
          dir="ltr"
          required
        />
      </div>
      {errorKey && (
        <p role="alert" className="text-sm text-destructive">
          {t(errorKey)}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t(`${mode}.submitting`) : t(`${mode}.submit`)}
      </Button>
    </form>
  );
}

const LANGUAGES: { code: 'fr' | 'ar' | 'en'; name: string }[] = [
  { code: 'fr', name: 'Français' },
  { code: 'ar', name: 'العربية' },
  { code: 'en', name: 'English' },
];

/** Same page in each language: swaps the leading locale segment of the current path. */
export function LanguageLinks() {
  const pathname = usePathname();
  const current = useLocale();
  return (
    <nav aria-label="Language" className="flex gap-3 text-sm">
      {LANGUAGES.map(({ code, name }) => (
        <Link
          key={code}
          href={pathname.replace(/^\/(fr|ar|en)(?=\/|$)/, `/${code}`)}
          lang={code}
          aria-current={code === current ? 'page' : undefined}
          className={code === current ? 'font-semibold underline' : 'text-muted-foreground hover:underline'}
        >
          {name}
        </Link>
      ))}
    </nav>
  );
}
