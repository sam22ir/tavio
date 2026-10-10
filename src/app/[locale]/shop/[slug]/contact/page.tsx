import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { resolveShop } from '@/modules/website/service/public';
import { ContactForm } from '@/modules/website/ui/contact-form';
import { ShopHeader } from '@/modules/website/ui/shop-header';

export default async function ShopContactPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const resolved = await resolveShop(slug);
  if (!resolved) notFound();
  const t = await getTranslations('website');
  const currentLocale = await getLocale();

  return (
    <main className="flex flex-col gap-6 p-4 md:p-6">
      <ShopHeader shop={resolved.shop} locale={currentLocale} />
      <h1 className="text-xl font-semibold">{t('contact.title')}</h1>
      <ContactForm slug={slug} />
    </main>
  );
}
