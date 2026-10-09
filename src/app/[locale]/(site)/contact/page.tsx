import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { buildMetadata } from '@/site/seo';
import { Section, SectionHeading } from '@/site/components';
import { ContactForm } from '@/site/contact/ContactForm';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'site_company.contact.meta' });
  return buildMetadata({ locale: locale as Locale, path: '/contact', title: t('title'), description: t('description') });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('site_company.contact');

  // Public number for the WhatsApp button. Digits only, e.g. 213550123456. Hidden when unset.
  const whatsapp = (process.env.NEXT_PUBLIC_CONTACT_WHATSAPP ?? '').replace(/\D/g, '');
  const contactEmail = process.env.CONTACT_EMAIL || process.env.EMAIL_FROM || '';

  return (
    <Section className="pt-12 md:pt-20">
      <div className="grid gap-12 md:grid-cols-[1fr_1.2fr] md:gap-16">
        <div className="flex flex-col gap-10">
          <SectionHeading as="h1" title={t('title')} body={t('body')} />

          {whatsapp ? (
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">{t('whatsapp.title')}</h2>
              <p className="text-muted-foreground">{t('whatsapp.body')}</p>
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-fit rounded-full border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                {t('whatsapp.cta')}
              </a>
            </div>
          ) : null}

          {contactEmail ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">{t('email')}</h2>
              <a href={`mailto:${contactEmail}`} className="w-fit text-primary underline-offset-4 hover:underline" dir="ltr">
                {contactEmail}
              </a>
            </div>
          ) : null}
        </div>

        <ContactForm />
      </div>
    </Section>
  );
}
