import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Aref_Ruqaa, IBM_Plex_Sans_Arabic, Inter, Inter_Tight, Instrument_Serif } from 'next/font/google';
import { notFound } from 'next/navigation';
import { getSession } from '@/core/auth/session';
import { routing } from '@/i18n/routing';
import { SiteFooter, SiteHeader } from '@/site/components';
import '@/site/site.css';

// Site-only fonts. Each is exposed as a CSS variable and only the locale's set is applied (see below).
const inter = Inter({ subsets: ['latin'], variable: '--f-inter' });
const interTight = Inter_Tight({ subsets: ['latin'], variable: '--f-inter-tight' });
const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--f-instrument' });
const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ['arabic'], weight: ['400', '500', '600', '700'], variable: '--f-plex-ar' });
const arefRuqaa = Aref_Ruqaa({ subsets: ['arabic'], weight: ['400', '700'], variable: '--f-aref' });

// The header shows "Open app" for signed-in visitors, so the marketing site reads the session.
export const dynamic = 'force-dynamic';

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const user = await getSession();

  const fontVars =
    locale === 'ar'
      ? [plexArabic.variable, arefRuqaa.variable]
      : [inter.variable, interTight.variable, instrumentSerif.variable];

  return (
    <div data-locale={locale} className={`site flex min-h-[100dvh] flex-col ${fontVars.join(' ')}`}>
      <SiteHeader locale={locale} signedIn={user !== null} />
      <main className="flex-1">{children}</main>
      <SiteFooter locale={locale} />
    </div>
  );
}
