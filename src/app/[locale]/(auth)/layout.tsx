import { getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { Card } from '@/ui/primitives/card';
import { routing } from '@/i18n/routing';
import { LanguageLinks } from './auth-form';

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <Card className="w-full max-w-sm gap-6 p-6">
        <header className="flex flex-col gap-1 text-center">
          <h1 className="flex items-center justify-center gap-2 text-2xl font-semibold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/revora-mark-blue.svg" alt="" width={28} height={28} className="size-7" />
            {t('app.name')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('app.tagline')}</p>
        </header>
        {children}
      </Card>
      <LanguageLinks />
    </main>
  );
}
