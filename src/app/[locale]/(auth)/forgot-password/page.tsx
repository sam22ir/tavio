import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { ForgotPasswordForm } from './forgot-password-form';

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t('forgot.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('forgot.subtitle')}</p>
      </div>
      <ForgotPasswordForm />
      <p className="text-sm text-muted-foreground">
        <Link href={`/${locale}/login`} className="font-medium text-primary underline-offset-4 hover:underline">
          {t('forgot.back_to_login')}
        </Link>
      </p>
    </>
  );
}
