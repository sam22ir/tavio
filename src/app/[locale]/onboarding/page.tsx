import { setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/core/auth/session';
import { routing } from '@/i18n/routing';
import { OnboardingWizard } from './onboarding-wizard';

// Every page here reads the session; never prerender at build time.
export const dynamic = 'force-dynamic';

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <OnboardingWizard />
    </main>
  );
}
