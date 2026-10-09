'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { routing, type Locale } from '@/i18n/routing';
import { authClient } from '@/core/auth/client';
import { switchCompany } from '@/ui/shell/actions';
import type { ShellCompany } from '@/ui/shell/load-shell';
import { Button } from '@/ui/primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/primitives/dropdown-menu';

const LOCALE_LABELS: Record<Locale, string> = { fr: 'Français', ar: 'العربية', en: 'English' };

export interface AccountMenuProps {
  email: string;
  companies: ShellCompany[];
  activeCompanyId: string;
}

/** Avatar menu holding the account email, company switcher, language switcher, settings and logout. */
export function AccountMenu({ email, companies, activeCompanyId }: AccountMenuProps) {
  const t = useTranslations('shell');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const initial = (email.trim()[0] ?? '?').toUpperCase();

  // Keep the same page: swap only the leading locale segment.
  const hrefFor = (l: Locale) => pathname.replace(/^\/(fr|ar|en)(?=\/|$)/, `/${l}`);

  function choose(id: string) {
    if (id === activeCompanyId) return;
    setError(null);
    startTransition(async () => {
      const res = await switchCompany(id);
      if (res.ok) router.refresh();
      else setError(t('company.error'));
    });
  }

  async function logout() {
    try {
      await authClient.signOut();
    } finally {
      router.push(`/${locale}/login`);
      router.refresh();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-9 rounded-full bg-background font-semibold"
          aria-label={t('nav.account')}
          disabled={pending}
        >
          <span aria-hidden="true">{initial}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-xs font-normal text-muted-foreground">
            <span className="sr-only">{t('user.loggedInAs')} </span>
            {t('company.label')}
          </span>
          <span className="truncate text-sm font-medium" title={email}>
            {email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t('company.switch')}</DropdownMenuLabel>
        {companies.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => choose(c.id)} aria-current={c.id === activeCompanyId}>
            <span className="flex-1 truncate">{c.name}</span>
            {c.id === activeCompanyId ? <Check aria-hidden="true" className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
        {error ? (
          <p role="alert" className="px-2 py-1 text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t('locale.label')}</DropdownMenuLabel>
        {routing.locales.map((l) => (
          <DropdownMenuItem key={l} asChild>
            <Link href={hrefFor(l)} hrefLang={l} lang={l} aria-current={l === locale ? 'true' : undefined}>
              <span className="flex-1">{LOCALE_LABELS[l]}</span>
              {l === locale ? <Check aria-hidden="true" className="size-4" /> : null}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/${locale}/settings`}>{t('nav.settings')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={logout}>{t('user.logout')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
