import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { getFeature } from '@/site/content/features';
import { localeHref } from '@/site/content/nav';
import { buildMetadata, FEATURE_SLUGS } from '@/site/seo';
import { CtaBand, CtaLink, DeviceFrame, Emphasis, FeatureList, PillLabel, Reveal, Section } from '@/site/components';

interface FeatureCopy {
  title: string;
  tagline: string;
  body: string;
  headline: string;
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
  const related = feature.related.map((rel) => getFeature(rel)).filter((f) => f !== undefined);

  return (
    <>
      {/* Hero: pill with the module name, headline with one accent word, subline, two CTAs. */}
      <section className="relative overflow-hidden px-4 pb-16 pt-14 md:pt-24">
        <div aria-hidden className="s-grid-bg pointer-events-none absolute inset-x-0 top-0 h-[70%]" />
        <div aria-hidden className="s-glow pointer-events-none absolute start-1/2 top-[12%] h-[380px] w-[min(640px,100%)] -translate-x-1/2 rounded-full" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-7 text-center">
          <PillLabel>{item.title}</PillLabel>
          <h1 className="s-h1 max-w-[18ch] text-balance">
            <Emphasis text={item.headline} />
          </h1>
          <p className="max-w-[58ch] text-[17px] leading-relaxed text-[color:var(--s-muted)] md:text-lg">{item.tagline}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <CtaLink href={localeHref(locale, '/signup')} label={t('detail.cta')} />
            <CtaLink href={localeHref(locale, '/pricing')} label={t('detail.secondary')} variant="light" arrow={false} />
          </div>
        </div>
      </section>

      {/* Large real screenshot. */}
      <section className="px-4 pb-8">
        <div className="mx-auto max-w-5xl">
          <DeviceFrame name={feature.screen} locale={locale} alt={item.title} priority className="w-full" />
        </div>
      </section>

      {/* Capabilities: body on the left, title/subline list on the right. */}
      <Reveal>
        <Section tone="muted" className="mt-12">
          <div className="grid gap-12 md:grid-cols-[1fr_1.1fr] md:gap-20">
            <div className="flex flex-col gap-6">
              <PillLabel>{t('detail.capabilitiesTitle')}</PillLabel>
              <p className="text-[17px] leading-relaxed text-[color:var(--s-muted)] md:text-lg">{item.body}</p>
            </div>
            <FeatureList items={item.capabilities.map((title) => ({ title, body: '' }))} />
          </div>
        </Section>
      </Reveal>

      {/* How it connects: related modules as linked cards. */}
      <Reveal>
        <Section>
          <div className="flex flex-col gap-10">
            <PillLabel>{t('detail.relatedTitle')}</PillLabel>
            <ul className="grid list-none grid-cols-1 gap-4 md:grid-cols-3">
              {related.map((rel) => (
                <li key={rel.slug}>
                  <Link
                    href={localeHref(locale, `/features/${rel.slug}`)}
                    className="s-panel group flex items-center justify-between gap-4 p-6 transition-transform duration-300 hover:-translate-y-0.5"
                  >
                    <span className="flex flex-col gap-1">
                      <span className="text-[17px] font-semibold">{t(`items.${rel.slug}.title`)}</span>
                      <span className="text-[14px] leading-relaxed text-[color:var(--s-muted)]">{t(`items.${rel.slug}.tagline`)}</span>
                    </span>
                    <ArrowUpRight size={18} strokeWidth={1.75} aria-hidden className="s-flip-rtl shrink-0 text-[color:var(--s-muted)] group-hover:text-[color:var(--s-accent)]" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      </Reveal>

      <Reveal>
        <Section className="pt-0">
          <CtaBand
            title={t('detail.ctaTitle')}
            body={t('detail.ctaBody')}
            primary={{ label: t('detail.ctaPrimary'), href: localeHref(locale, '/signup') }}
            secondary={{ label: t('detail.secondary'), href: localeHref(locale, '/pricing') }}
          />
        </Section>
      </Reveal>
    </>
  );
}
