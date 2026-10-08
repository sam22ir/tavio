import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/core/auth/session';
import { routing } from '@/i18n/routing';
import { Button } from '@/ui/primitives/button';
import { Input } from '@/ui/primitives/input';
import { Label } from '@/ui/primitives/label';
import { createCompanyAction } from './actions';

// Every page here reads the session; never prerender at build time.
export const dynamic = 'force-dynamic';

// Reads the session and the user's memberships, so it blocks navigation by design.

export default async function OnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/login`);

  const { error } = await searchParams;
  const t = await getTranslations('auth');

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{t('onboarding.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('onboarding.subtitle')}</p>
        </div>
        <form action={createCompanyAction} className="flex flex-col gap-4">
          <input type="hidden" name="locale" value={locale} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="legalName">{t('onboarding.fields.legalName')}</Label>
            <Input id="legalName" name="legalName" type="text" minLength={2} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">{t('onboarding.fields.phone')}</Label>
            <Input id="phone" name="phone" type="tel" autoComplete="tel" dir="ltr" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="address">{t('onboarding.fields.address')}</Label>
            <Input id="address" name="address" type="text" autoComplete="street-address" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="wilayaCode">{t('onboarding.fields.wilaya')}</Label>
            <Input id="wilayaCode" name="wilayaCode" type="text" dir="ltr" />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {t('onboarding.error')}
            </p>
          )}
          <Button type="submit" className="w-full">
            {t('onboarding.submit')}
          </Button>
        </form>
      </div>
    </main>
  );
}
