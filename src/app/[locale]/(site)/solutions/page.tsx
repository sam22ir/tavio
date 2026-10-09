import type { Metadata } from 'next';
import Link from 'next/link';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowRight, Briefcase, Car, Factory, GraduationCap, HeartPulse, Refrigerator, ShoppingCart, type LucideIcon } from 'lucide-react';
import { routing } from '@/i18n/routing';
import { buildMetadata, SOLUTION_SLUGS } from '@/site/seo';
import { localeHref } from '@/site/content/nav';
import { SOLUTION_SEEDS, type SolutionSlug } from '@/site/content/solutions';
import { BlueHero, CtaBand, CtaLink, Reveal, RevealItem, RevealList, Section } from '@/site/components';

const ICONS: Record<(typeof SOLUTION_SEEDS)[SolutionSlug]['icon'], LucideIcon> = {
  appliance: Refrigerator,
  car: Car,
  clinic: HeartPulse,
  training: GraduationCap,
  store: ShoppingCart,
  services: Briefcase,
  industry: Factory,
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
<BlueHero uppercase={locale !== 'ar'} eyebrow={t('indexEyebrow')} title={t('indexTitle')} subtitle={t('indexBody')} />

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
          <div className="s-panel grid gap-6 p-7 md:grid-cols-[1fr_auto] md:items-center md:p-10">
            <div className="flex flex-col gap-3">
              <h2 className="text-xl">{t('services.title')}</h2>
              <p className="leading-relaxed text-[color:var(--s-muted)]">{t('services.body')}</p>
            </div>
            <CtaLink href={localeHref(locale, '/services')} label={t('services.cta')} />
          </div>
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
