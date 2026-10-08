import type { Metadata } from 'next';
import { Inter, Noto_Sans_Arabic } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { dirFor } from '@/core/i18n/dir';
import { routing, type Locale } from '@/i18n/routing';
import '../globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const notoArabic = Noto_Sans_Arabic({ variable: '--font-noto-arabic', subsets: ['arabic'] });

export const metadata: Metadata = {
  title: 'Tavio',
};

export function generateStaticParams(): { locale: Locale }[] {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  const fontClass = locale === 'ar' ? notoArabic.variable : inter.variable;

  return (
    <html lang={locale} dir={dirFor(locale)} className={`${fontClass} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
