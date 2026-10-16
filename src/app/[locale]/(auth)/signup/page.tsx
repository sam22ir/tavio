import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { AuthForm } from '../auth-form';

export default async function SignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const { locale } = await params;
  const { email } = await searchParams;
  const defaultEmail = typeof email === 'string' ? email : undefined;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t('signup.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('signup.subtitle')}</p>
      </div>
      <AuthForm mode="signup" defaultEmail={defaultEmail} />
      <p className="text-sm text-muted-foreground">
        {t('signup.has_account')}{' '}
        <Link href={`/${locale}/login`} className="font-medium text-primary underline-offset-4 hover:underline">
          {t('signup.login_link')}
        </Link>
      </p>
    </>
  );
}
