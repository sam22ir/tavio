import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/core/auth/session';
import { routing } from '@/i18n/routing';

// Every page here reads the session; never prerender at build time.
export const dynamic = 'force-dynamic';

// Reads the session to pick the redirect target, so it blocks navigation by design.

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const user = await getSession();
  redirect(user ? `/${locale}/dashboard` : `/${locale}/login`);
}
