import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowUpRight,
  Calculator,
  CreditCard,
  FolderKanban,
  Package,
  Plug,
  Receipt,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { FEATURES, PILLARS, type FeatureSlug } from '@/site/content/features';
import { localeHref } from '@/site/content/nav';
import { buildMetadata } from '@/site/seo';
import { BlueHero, CtaBand, PillLabel, Reveal, RevealItem, RevealList, Section } from '@/site/components';

/** One icon per module, shown in a soft blue circle on each card. */
const MODULE_ICONS: Record<FeatureSlug, LucideIcon> = {
  'credit-sales': CreditCard,
  crm: Users,
  'sales-invoicing': Receipt,
  'inventory-purchases': Package,
  accounting: Calculator,
  pos: Store,
  hr: UsersRound,
  'projects-helpdesk': FolderKanban,
  'website-shop': ShoppingBag,
  ai: Sparkles,
  platform: Plug,
};

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
      <BlueHero eyebrow={t('overview.eyebrow')} title={t('overview.title')} subtitle={t('overview.body')} />

      {/* The five growth pillars, each with its module cards linking to the detail pages. */}
      {PILLARS.map((pillar, pi) => {
        const modules = FEATURES.filter((f) => (pillar.slugs as readonly string[]).includes(f.slug));
        return (
          <Reveal key={pillar.key}>
            <Section tone={pi % 2 === 1 ? 'muted' : 'default'} className={pi === 0 ? 'pt-14 md:pt-20' : undefined}>
              <div className="flex flex-col gap-10">
                <div className="flex max-w-2xl flex-col gap-4">
                  <PillLabel>{t(`overview.pillars.${pillar.key}.title`)}</PillLabel>
                  <h2 className="s-h2 !text-[2.25rem] md:!text-[2.75rem]">{t(`overview.pillars.${pillar.key}.title`)}</h2>
                  <p className="text-[17px] leading-relaxed text-[color:var(--s-muted)] md:text-lg">{t(`overview.pillars.${pillar.key}.body`)}</p>
                </div>
                <RevealList as="ul" className="grid list-none grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {modules.map((f) => {
                    const Icon = MODULE_ICONS[f.slug];
                    return (
                      <RevealItem key={f.slug} className="min-w-0">
                        <Link
                          href={localeHref(locale, `/features/${f.slug}`)}
                          className="s-panel group flex h-full flex-col justify-between gap-8 p-7 transition-transform duration-300 hover:-translate-y-0.5 md:p-8"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--s-accent-soft)] text-[color:var(--s-accent)]">
                              <Icon size={20} strokeWidth={1.75} aria-hidden />
                            </span>
                            <ArrowUpRight
                              size={18}
                              strokeWidth={1.75}
                              aria-hidden
                              className="s-flip-rtl text-[color:var(--s-muted)] transition-colors group-hover:text-[color:var(--s-accent)]"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <h3 className="text-xl">{t(`items.${f.slug}.title`)}</h3>
                            <p className="leading-relaxed text-[color:var(--s-muted)]">{t(`items.${f.slug}.tagline`)}</p>
                          </div>
                        </Link>
                      </RevealItem>
                    );
                  })}
                </RevealList>
              </div>
            </Section>
          </Reveal>
        );
      })}

      <Reveal>
        <Section tone="muted">
          <CtaBand
            title={t('detail.ctaTitle')}
            body={t('detail.ctaBody')}
            primary={{ label: t('detail.ctaPrimary'), href: localeHref(locale, '/signup') }}
          />
        </Section>
      </Reveal>
    </>
  );
}
