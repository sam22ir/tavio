import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { localeHref } from '@/site/content/nav';
import { buildMetadata } from '@/site/seo';
import { PageHero, CtaBand, Reveal, Section } from '@/site/components';
import { FaqFilter } from './FaqFilter';

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
<PageHero eyebrow={t('eyebrow')} title={t('title')} subtitle={t('body')} />

      <Reveal>
        <Section className="pt-8">
          <div className="mx-auto max-w-3xl">
            <FaqFilter groups={groups} allLabel={t('all')} />
          </div>
        </Section>
      </Reveal>

      <Reveal>
        <Section className="pt-0">
          <CtaBand
            title={t('cta.title')}
            body={t('cta.body')}
            primary={{ label: t('cta.primary'), href: localeHref(locale, '/contact') }}
          />
        </Section>
      </Reveal>
    </>
  );
}
