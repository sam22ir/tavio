import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { routing, type Locale } from '@/i18n/routing';
import { localeHref } from '@/site/content/nav';
import { buildMetadata } from '@/site/seo';
import { Faq, Section, SectionHeading } from '@/site/components';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'site_company.faq.meta' });
  return buildMetadata({ locale: locale as Locale, path: '/faq', title: t('title'), description: t('description') });
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('site_company.faq');

  const groups = t.raw('groups') as { title: string; items: { question: string; answer: string }[] }[];

  return (
    <>
      <Section className="pt-12 md:pt-20">
        <SectionHeading as="h1" title={t('title')} body={t('body')} />
      </Section>

      {groups.map((group) => (
        <Section key={group.title}>
          <h2 className="mb-6 text-xl font-semibold tracking-tight md:text-2xl">{group.title}</h2>
          <Faq items={group.items} />
        </Section>
      ))}

      <Section tone="muted">
        <p className="text-base">
          {t('stillQuestions')}{' '}
          <Link href={localeHref(locale, '/contact')} className="font-medium text-primary underline-offset-4 hover:underline">
            {t('contactLink')}
          </Link>
        </p>
      </Section>
    </>
  );
}
