import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { ResetPasswordForm } from './reset-password-form';

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations('auth');

  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t('reset.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('reset.subtitle')}</p>
      </div>
      <ResetPasswordForm token={token ?? ''} />
      <p className="text-sm text-muted-foreground">
        <Link href={`/${locale}/login`} className="font-medium text-primary underline-offset-4 hover:underline">
          {t('reset.back_to_login')}
        </Link>
      </p>
    </>
  );
}
