import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getSession } from '@/core/auth/session';
import { routing } from '@/i18n/routing';
import { SiteFooter, SiteHeader } from '@/site/components';

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

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteHeader locale={locale} signedIn={user !== null} />
      <main className="flex-1">{children}</main>
      <SiteFooter locale={locale} />
    </div>
  );
}
