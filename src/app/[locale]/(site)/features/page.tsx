import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { FEATURES } from '@/site/content/features';
import { localeHref } from '@/site/content/nav';
import { buildMetadata } from '@/site/seo';
import { CtaBand, FeatureGrid, Section, SectionHeading } from '@/site/components';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'site_features' });
  return buildMetadata({
    locale,
    path: '/features',
    title: t('overview.metaTitle'),
    description: t('overview.metaDescription'),
  });
}

export default async function FeaturesOverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('site_features');

  return (
    <>
      <Section className="pt-12 md:pt-20">
        <SectionHeading as="h1" title={t('overview.title')} body={t('overview.body')} />
      </Section>

      <Section className="pt-0">
        <FeatureGrid
          columns={3}
          items={FEATURES.map((f) => ({
            title: t(`items.${f.slug}.title`),
            body: t(`items.${f.slug}.tagline`),
            href: localeHref(locale, `/features/${f.slug}`),
          }))}
        />
      </Section>

      <Section tone="muted">
        <CtaBand
          title={t('detail.ctaTitle')}
          body={t('detail.ctaBody')}
          primary={{ label: t('detail.ctaPrimary'), href: localeHref(locale, '/signup') }}
        />
      </Section>
    </>
  );
}
