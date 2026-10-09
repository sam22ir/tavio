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
import { FEATURES, type FeatureSlug } from '@/site/content/features';
import { localeHref } from '@/site/content/nav';
import { buildMetadata } from '@/site/seo';
import { CtaBand, Emphasis, PillLabel, Reveal, RevealItem, RevealList, Section } from '@/site/components';

/** One icon per module, shown in a soft-green circle on each card. */
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

/**
 * Bento spans on md+ (3 columns), by index. Rows: [2,1] [1,1,1] [1,2] [1,1,1] [3].
 * Full class names so Tailwind picks them up.
 */
const BENTO_SPAN: Record<number, string> = {
  0: 'md:col-span-2',
  6: 'md:col-span-2',
  10: 'md:col-span-3',
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
      {/* Hero: pill, headline with one accent word, subline. */}
      <section className="relative overflow-hidden px-4 pb-12 pt-14 md:pb-16 md:pt-24">
        <div aria-hidden className="s-grid-bg pointer-events-none absolute inset-x-0 top-0 h-[70%]" />
        <div aria-hidden className="s-glow pointer-events-none absolute start-1/2 top-[10%] h-[380px] w-[640px] -translate-x-1/2 rounded-full" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-7 text-center">
          <PillLabel>{t('overview.eyebrow')}</PillLabel>
          <h1 className="s-h1 max-w-[18ch] text-balance">
            <Emphasis text={t('overview.title')} />
          </h1>
          <p className="max-w-[58ch] text-[17px] leading-relaxed text-[color:var(--s-muted)] md:text-lg">{t('overview.body')}</p>
        </div>
      </section>

      {/* Bento grid of module cards, each linking to its detail page. */}
      <Section className="pt-6 md:pt-10">
        <RevealList as="ul" className="grid list-none grid-cols-1 gap-4 md:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = MODULE_ICONS[f.slug];
            return (
              <RevealItem key={f.slug} className={`min-w-0 ${BENTO_SPAN[i] ?? ''}`}>
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
                    <h2 className="text-xl">{t(`items.${f.slug}.title`)}</h2>
                    <p className="leading-relaxed text-[color:var(--s-muted)]">{t(`items.${f.slug}.tagline`)}</p>
                  </div>
                </Link>
              </RevealItem>
            );
          })}
        </RevealList>
      </Section>

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
