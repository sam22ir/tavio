'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/ui/lib/cn';

const LANGUAGES = [
  { code: 'fr', name: 'FR' },
  { code: 'ar', name: 'عربي' },
  { code: 'en', name: 'EN' },
] as const;

/** Switches the locale prefix of the current path, keeping the same page. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const pathname = usePathname();
  const current = useLocale();
  const t = useTranslations('site.nav');
  return (
    <nav aria-label={t('language')} className={cn('flex items-center gap-1 text-sm', className)}>
      {LANGUAGES.map(({ code, name }) => (
        <Link
          key={code}
          href={pathname.replace(/^\/(fr|ar|en)(?=\/|$)/, `/${code}`)}
          lang={code}
          aria-current={code === current ? 'page' : undefined}
          className={cn(
            'rounded-md px-2 py-1 transition-colors',
            code === current ? 'bg-muted font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {name}
        </Link>
      ))}
    </nav>
  );
}
