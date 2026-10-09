import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { buildMetadata, SOLUTION_SLUGS } from '@/site/seo';
import { localeHref } from '@/site/content/nav';
import { CtaBand, FeatureGrid, Section } from '@/site/components';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'site_pricing.solutions.indexMeta' });
  return buildMetadata({ locale, path: '/solutions', title: t('title'), description: t('description') });
}

export default async function SolutionsIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('site_pricing.solutions');

  return (
    <>
      <Section className="pt-12 md:pt-20">
        <div className="flex max-w-3xl flex-col gap-5">
          <h1 className="text-4xl font-semibold tracking-tighter md:text-6xl">{t('indexTitle')}</h1>
          <p className="max-w-[65ch] text-base leading-relaxed text-muted-foreground md:text-lg">{t('indexBody')}</p>
        </div>
        <div className="mt-12">
          <FeatureGrid
            items={SOLUTION_SLUGS.map((slug, i) => ({
              title: t(`items.${slug}.title`),
              body: t(`items.${slug}.short`),
              href: localeHref(locale, `/solutions/${slug}`),
              featured: i === 0,
            }))}
          />
        </div>
      </Section>

      <Section tone="muted">
        <CtaBand
          title={t('ctaTitle')}
          body={t('ctaBody')}
          primary={{ label: t('cta'), href: localeHref(locale, '/signup') }}
        />
      </Section>
    </>
  );
}
