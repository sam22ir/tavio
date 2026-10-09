import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { notFound } from 'next/navigation';
import { getSession } from '@/core/auth/session';
import { routing } from '@/i18n/routing';
import { SiteFooter, SiteHeader } from '@/site/components';
import '@/site/site.css';

// Site-only fonts (Revora brand). Each is exposed as a CSS variable; only the locale's family is applied.
const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--f-plex' });
const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ['arabic'], weight: ['400', '500', '700'], variable: '--f-plex-ar' });

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

  const fontVars = locale === 'ar' ? [plexArabic.variable] : [plex.variable];

  return (
    <div data-locale={locale} className={`site flex min-h-[100dvh] flex-col ${fontVars.join(' ')}`}>
      <SiteHeader locale={locale} signedIn={user !== null} />
      <main className="flex-1">{children}</main>
      <SiteFooter locale={locale} />
    </div>
  );
}
