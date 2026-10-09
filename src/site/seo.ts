import type { Metadata } from 'next';
import { locales, routing, type Locale } from '@/i18n/routing';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://tavio.nafaa-store.workers.dev').replace(/\/$/, '');

export const SITE_LOCALES: readonly Locale[] = locales;

// Hard-coded from WAVE-7.md until src/site/content/features.ts and solutions.ts exist.
export const FEATURE_SLUGS = [
  'credit-sales',
  'crm',
  'sales-invoicing',
  'inventory-purchases',
  'accounting',
  'pos',
  'hr',
  'projects-helpdesk',
  'website-shop',
  'ai',
  'platform',
] as const;

export const SOLUTION_SLUGS = [
  'electromenager-credit',
  'car-dealers',
  'clinics',
  'training-centers',
  'retail-pos',
] as const;

/** Public marketing paths, relative to the locale prefix. */
export const MARKETING_PATHS: readonly string[] = [
  '',
  '/features',
  ...FEATURE_SLUGS.map((s) => `/features/${s}`),
  '/solutions',
  ...SOLUTION_SLUGS.map((s) => `/solutions/${s}`),
  '/pricing',
  '/on-premise',
  '/about',
  '/contact',
  '/faq',
  '/legal/privacy',
  '/legal/terms',
];

/** Path prefixes (after the locale) that must not be indexed. */
export const DISALLOWED_APP_SEGMENTS = [
  'dashboard',
  'settings',
  'accounting',
  'assistant',
  'contacts',
  'credit',
  'crm',
  'helpdesk',
  'hr',
  'inventory',
  'invoicing',
  'marketing',
  'onboarding',
  'pos',
  'products',
  'projects',
  'purchases',
  'sales',
  'website',
] as const;

export const OG_IMAGE = { url: '/og.svg', width: 1200, height: 630, type: 'image/svg+xml' } as const;

export function localizedUrl(locale: Locale, path: string): string {
  return `${SITE_URL}/${locale}${path}`;
}

/** hreflang alternates for fr/ar/en plus x-default (French). */
export function buildAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of SITE_LOCALES) {
    languages[locale] = localizedUrl(locale, path);
  }
  languages['x-default'] = localizedUrl(routing.defaultLocale, path);
  return languages;
}

export function buildMetadata(opts: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
}): Metadata {
  const url = localizedUrl(opts.locale, opts.path);
  return {
    metadataBase: new URL(SITE_URL),
    title: opts.title,
    description: opts.description,
    alternates: {
      canonical: url,
      languages: buildAlternates(opts.path),
    },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: 'Revora',
      locale: opts.locale,
      type: 'website',
      images: [OG_IMAGE],
    },
  };
}
