import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { AuthForm } from '../auth-form';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t('login.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('login.subtitle')}</p>
      </div>
      <AuthForm mode="login" />
      <p className="text-sm text-muted-foreground">
        {t('login.no_account')}{' '}
        <Link href={`/${locale}/signup`} className="font-medium text-primary underline-offset-4 hover:underline">
          {t('login.signup_link')}
        </Link>
      </p>
    </>
  );
}
