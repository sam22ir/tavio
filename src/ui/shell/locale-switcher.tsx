'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { routing, type Locale } from '@/i18n/routing';

const LABELS: Record<Locale, string> = { fr: 'Français', ar: 'العربية', en: 'English' };

export function LocaleSwitcher() {
  const t = useTranslations('shell');
  const current = useLocale() as Locale;
  const pathname = usePathname();

  // Keep the same page: swap only the leading locale segment.
  const hrefFor = (l: Locale) => pathname.replace(/^\/(fr|ar|en)(?=\/|$)/, `/${l}`);

  return (
    <nav aria-label={t('locale.label')} className="flex gap-1">
      {routing.locales.map((l) => (
        <Link
          key={l}
          href={hrefFor(l)}
          hrefLang={l}
          lang={l}
          aria-current={l === current ? 'true' : undefined}
          className={
            'rounded-md px-2 py-1 text-xs ' +
            (l === current ? 'bg-accent font-semibold text-accent-foreground' : 'text-muted-foreground hover:bg-accent')
          }
        >
          {LABELS[l]}
        </Link>
      ))}
    </nav>
  );
}
