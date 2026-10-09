import type { Metadata } from 'next';
import Link from 'next/link';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowRight, Car, GraduationCap, HeartPulse, Refrigerator, ShoppingCart, type LucideIcon } from 'lucide-react';
import { routing } from '@/i18n/routing';
import { buildMetadata, SOLUTION_SLUGS } from '@/site/seo';
import { localeHref } from '@/site/content/nav';
import { SOLUTION_SEEDS, type SolutionSlug } from '@/site/content/solutions';
import { CtaBand, PillLabel, Reveal, RevealItem, RevealList, Section } from '@/site/components';

const ICONS: Record<(typeof SOLUTION_SEEDS)[SolutionSlug]['icon'], LucideIcon> = {
  appliance: Refrigerator,
  car: Car,
  clinic: HeartPulse,
  training: GraduationCap,
  store: ShoppingCart,
};

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
      {/* Hero: pill, headline and intro on the cream background with the soft glow. */}
      <section className="relative overflow-hidden px-4 pb-12 pt-14 md:pb-16 md:pt-24">
        <div aria-hidden className="s-grid-bg pointer-events-none absolute inset-x-0 top-0 h-[80%]" />
        <div aria-hidden className="s-glow pointer-events-none absolute start-1/2 top-[10%] h-[400px] w-[min(640px,100%)] -translate-x-1/2 rounded-full" />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <PillLabel>{t('indexEyebrow')}</PillLabel>
          <h1 className="s-h1 text-balance">{t('indexTitle')}</h1>
          <p className="max-w-[58ch] text-[17px] leading-relaxed text-[color:var(--s-muted)] md:text-lg">{t('indexBody')}</p>
        </div>
      </section>

      {/* One card per business type: icon, the problem in one line, and a link. */}
      <Reveal>
        <Section className="pt-6">
          <RevealList className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {SOLUTION_SLUGS.map((slug) => {
              const Icon = ICONS[SOLUTION_SEEDS[slug].icon];
              return (
                <RevealItem key={slug} className="h-full">
                  <Link
                    href={localeHref(locale, `/solutions/${slug}`)}
                    className="s-panel group flex h-full flex-col gap-6 p-7 transition-transform duration-500 hover:-translate-y-1 md:p-8"
                  >
                    <span className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--s-accent-soft)] text-[color:var(--s-accent)]">
                      <Icon size={22} strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="flex flex-1 flex-col gap-3">
                      <h2 className="text-xl">{t(`items.${slug}.title`)}</h2>
                      <p className="leading-relaxed text-[color:var(--s-muted)]">{t(`items.${slug}.problemLine`)}</p>
                    </div>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--s-accent)]">
                      {t('open')}
                      <ArrowRight size={16} strokeWidth={1.75} className="s-flip-rtl transition-transform duration-500 group-hover:translate-x-1" aria-hidden />
                    </span>
                  </Link>
                </RevealItem>
              );
            })}
          </RevealList>
        </Section>
      </Reveal>

      <Reveal>
        <Section className="pt-0">
          <CtaBand
            title={t('ctaTitle')}
            body={t('ctaBody')}
            primary={{ label: t('cta'), href: localeHref(locale, '/signup') }}
          />
        </Section>
      </Reveal>
    </>
  );
}
