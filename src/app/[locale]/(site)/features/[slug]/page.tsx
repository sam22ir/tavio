import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { getFeature } from '@/site/content/features';
import { localeHref } from '@/site/content/nav';
import { buildMetadata, FEATURE_SLUGS } from '@/site/seo';
import { CtaBand, FeatureGrid, FeatureRow, Hero, MockScreen, Section, SectionHeading } from '@/site/components';

interface FeatureCopy {
  title: string;
  tagline: string;
  body: string;
  capabilities: string[];
}

type Params = Promise<{ locale: string; slug: string }>;

/** Prerender every module page for each locale. Unknown slugs fall through to `notFound()`. */
export function generateStaticParams() {
  return routing.locales.flatMap((locale) => FEATURE_SLUGS.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale) || !getFeature(slug)) return {};
  const t = await getTranslations({ locale, namespace: 'site_features' });
  const item = t.raw(`items.${slug}`) as FeatureCopy;
  return buildMetadata({ locale, path: `/features/${slug}`, title: item.title, description: item.tagline });
}

export default async function FeatureDetailPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const feature = getFeature(slug);
  if (!feature) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('site_features');
  const item = t.raw(`items.${feature.slug}`) as FeatureCopy;

  return (
    <>
      <Section className="pt-12 md:pt-20">
        <Hero
          title={item.title}
          subtitle={item.tagline}
          primary={{ label: t('detail.cta'), href: localeHref(locale, '/signup') }}
          secondary={{ label: t('detail.secondary'), href: localeHref(locale, '/pricing') }}
        />
      </Section>

      <Section tone="muted">
        <FeatureRow
          title={t('detail.capabilitiesTitle')}
          body={item.body}
          bullets={item.capabilities}
          visual={<MockScreen variant={feature.mock} />}
        />
      </Section>

      <Section>
        <SectionHeading title={t('detail.relatedTitle')} />
        <div className="mt-10">
          <FeatureGrid
            columns={3}
            items={feature.related.map((rel) => ({
              title: t(`items.${rel}.title`),
              body: t(`items.${rel}.tagline`),
              href: localeHref(locale, `/features/${rel}`),
            }))}
          />
        </div>
      </Section>

      <Section tone="muted">
        <CtaBand
          title={t('detail.ctaTitle')}
          body={t('detail.ctaBody')}
          primary={{ label: t('detail.ctaPrimary'), href: localeHref(locale, '/signup') }}
          secondary={{ label: t('detail.secondary'), href: localeHref(locale, '/pricing') }}
        />
      </Section>
    </>
  );
}
