import type { Metadata } from 'next';
import { BookOpen, FileText, Landmark, Smartphone, Banknote, Percent } from 'lucide-react';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { SAAS_PLAN_SEED } from '@/modules/subscriptions/plans';
import { routing } from '@/i18n/routing';
import { localeHref } from '@/site/content/nav';
import {
  ConnectorDiagram,
  CtaBand,
  CtaLink,
  CurvedTimeline,
  DeviceFrame,
  Emphasis,
  Faq,
  FeatureList,
  FloatingBadges,
  ModulesOrbit,
  PillLabel,
  PricingCards,
  Section,
  SectionHeading,
  type PricingPlan,
} from '@/site/components';

export const dynamic = 'force-dynamic';

/** Icons for the Algeria bento tiles, in message order. */
const ALGERIA_ICONS = [Banknote, Percent, BookOpen, FileText, Landmark, Smartphone];

/** Formats a whole-DZD amount with thin-space thousands separators. */
function formatDzd(amount: number): string {
  return `${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} DZD`;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'site.home.meta' });
  return { title: t('title'), description: t('description') };
}

type Feature = {
  eyebrow: string;
  title: string;
  body: string;
  screen: string;
  items: { title: string; body: string }[];
};

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('site.home');

  const features = t.raw('features') as Feature[];
  const modules = t.raw('modules.items') as { slug: string; title: string; body: string }[];
  const algeria = t.raw('algeria.items') as { title: string; body: string }[];
  const how = t.raw('how.items') as { title: string; body: string }[];
  const faq = t.raw('faq.items') as { question: string; answer: string }[];
  const planFeatures = t.raw('pricing.features') as Record<string, string[]>;
  const beforeItems = t.raw('before.before') as string[];
  const afterItems = t.raw('before.after') as string[];
  const dark = { ai: t.raw('dark.ai') as { title: string; body: string }, onPremise: t.raw('dark.onPremise') as { title: string; body: string } };

  const plans: PricingPlan[] = SAAS_PLAN_SEED.map((plan) => {
    const dzd = Number(plan.pricePerUserCents / 100n);
    const isPro = plan.code === 'pro';
    return {
      name: t(`pricing.planNames.${plan.code}`),
      price: dzd === 0 ? t('pricing.free') : formatDzd(dzd),
      period: dzd === 0 ? '' : t('pricing.perUser'),
      users: t('pricing.users', { count: plan.maxUsers }),
      features: planFeatures[plan.code] ?? [],
      href: localeHref(locale, '/signup'),
      cta: t('hero.primary'),
      highlighted: isPro,
      badge: isPro ? t('pricing.popular') : undefined,
    };
  });

  return (
    <>
      {/* Hero: pill, headline, CTAs, then the laptop with a phone and floating badges over a soft glow and grid. */}
      <section className="relative overflow-hidden px-4 pb-20 pt-14 md:pt-24">
        <div aria-hidden className="s-grid-bg pointer-events-none absolute inset-x-0 top-0 h-[80%]" />
        <div aria-hidden className="s-glow pointer-events-none absolute start-1/2 top-[18%] h-[480px] w-[720px] -translate-x-1/2 rounded-full" />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-7 text-center">
            <PillLabel>{t('hero.eyebrow')}</PillLabel>
            <h1 className="s-h1 max-w-[16ch] text-balance">
              <Emphasis text={t('hero.title')} />
            </h1>
            <p className="max-w-[58ch] text-[17px] leading-relaxed text-[color:var(--s-muted)] md:text-lg">{t('hero.subtitle')}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <CtaLink href={localeHref(locale, '/signup')} label={t('hero.primary')} />
              <CtaLink href={localeHref(locale, '/contact')} label={t('hero.secondary')} variant="light" arrow={false} />
            </div>
          </div>

          <div className="relative mx-auto mt-16 w-full max-w-5xl">
            <DeviceFrame name="dashboard" locale={locale} device="laptop" priority className="hidden w-full md:block" />
            <DeviceFrame
              name="phone-dashboard"
              locale={locale}
              device="phone"
              priority
              className="s-float mx-auto w-[72%] max-w-[300px] md:absolute md:-bottom-10 md:end-2 md:w-[24%] md:max-w-[230px]"
            />
            <FloatingBadges
              items={[
                { kind: 'dzd', label: 'DZD' },
                { kind: 'ccp', label: 'CCP' },
                { kind: 'whatsapp', label: 'WhatsApp' },
                { kind: 'invoice', label: t('badges.invoice') },
                { kind: 'tva', label: 'TVA' },
              ]}
            />
          </div>
        </div>
      </section>

      {/* Pilot band: no logos, no counts. */}
      <section className="px-4 pb-8">
        <div className="s-panel mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-6 py-6 md:flex-row md:px-8">
          <p className="text-[16px] font-medium">{t('pilot.text')}</p>
          <CtaLink href={localeHref(locale, '/contact')} label={t('pilot.cta')} variant="light" />
        </div>
      </section>

      {/* Before and after. */}
      <Section>
        <div className="flex flex-col gap-12">
          <SectionHeading eyebrow={t('before.eyebrow')} title={t('before.title')} body={t('before.body')} />
          <ConnectorDiagram
            beforeLabel={t('before.beforeLabel')}
            afterLabel={t('before.afterLabel')}
            before={beforeItems}
            after={afterItems}
            center={<span className="s-mark !size-14 !rounded-2xl !text-2xl">T</span>}
          />
        </div>
      </Section>

      {/* Three alternating feature sections: screenshot + title/subline list. */}
      {features.map((feature, i) => (
        <Section key={feature.screen} tone={i === 1 ? 'muted' : 'default'}>
          <div className="grid items-center gap-12 md:grid-cols-2 md:gap-20">
            <div className={`flex flex-col gap-6 ${i % 2 === 1 ? 'md:order-2' : ''}`}>
              <PillLabel>{feature.eyebrow}</PillLabel>
              <h2 className="s-h2 !text-[2.25rem] md:!text-[2.75rem]">
                <Emphasis text={feature.title} />
              </h2>
              <p className="text-[17px] leading-relaxed text-[color:var(--s-muted)]">{feature.body}</p>
              <FeatureList items={feature.items} />
            </div>
            <div className={`min-w-0 ${i % 2 === 1 ? 'md:order-1' : ''}`}>
              <DeviceFrame name={feature.screen} locale={locale} alt={feature.title.replace(/\*/g, '')} />
            </div>
          </div>
        </Section>
      ))}

      {/* Modules orbit, linking to each feature page. */}
      <Section id="modules">
        <div className="flex flex-col items-center gap-14">
          <SectionHeading eyebrow={t('modules.eyebrow')} title={t('modules.title')} body={t('modules.body')} />
          <ModulesOrbit
            items={modules.map((m) => ({ title: m.title, href: localeHref(locale, `/features/${m.slug}`) }))}
            center={<span className="s-mark !size-14 !rounded-2xl !text-2xl">T</span>}
          />
        </div>
      </Section>

      {/* Built for Algeria: asymmetric bento, collapses to one column. */}
      <Section tone="muted">
        <div className="flex flex-col gap-12">
          <SectionHeading eyebrow={t('algeria.eyebrow')} title={t('algeria.title')} body={t('algeria.body')} />
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {algeria.map((item, i) => {
              const Icon = ALGERIA_ICONS[i] ?? Banknote;
              return (
                <li key={item.title} className="s-panel flex flex-col justify-between gap-6 p-7 md:p-8">
                  <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--s-accent-soft)] text-[color:var(--s-accent)]">
                    <Icon size={20} strokeWidth={1.75} aria-hidden />
                  </span>
                  <h3 className="text-xl">{item.title}</h3>
                  <p className="leading-relaxed text-[color:var(--s-muted)]">{item.body}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </Section>

      {/* The one dark section: AI helpers and on-premise, with the CRM screen. */}
      <section className="s-dark px-4 py-24 md:py-36">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-14 md:grid-cols-2 md:gap-20">
          <div className="flex flex-col gap-6">
            <PillLabel tone="dark">{t('dark.eyebrow')}</PillLabel>
            <h2 className="s-h2">
              <Emphasis text={t('dark.title')} />
            </h2>
            <p className="s-muted text-[17px] leading-relaxed">{t('dark.body')}</p>
            <FeatureList tone="dark" items={[dark.ai, dark.onPremise]} />
          </div>
          <DeviceFrame name="crm-kanban" locale={locale} alt="" className="min-w-0" />
        </div>
      </section>

      {/* How it works: curved timeline. */}
      <Section>
        <div className="flex flex-col gap-16">
          <SectionHeading eyebrow={t('how.eyebrow')} title={t('how.title')} />
          <CurvedTimeline steps={how} />
        </div>
      </Section>

      {/* Pricing teaser. */}
      <Section tone="muted">
        <div className="flex flex-col gap-12">
          <SectionHeading eyebrow={t('pricing.eyebrow')} title={t('pricing.title')} body={t('pricing.body')} />
          <PricingCards plans={plans} />
          <div>
            <CtaLink href={localeHref(locale, '/pricing')} label={t('pricing.cta')} variant="light" />
          </div>
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 md:grid-cols-[1fr_1.4fr] md:gap-20">
          <SectionHeading eyebrow={t('faq.eyebrow')} title={t('faq.title')} />
          <Faq items={faq} />
        </div>
      </Section>

      <Section className="pt-0">
        <CtaBand
          title={t('cta.title')}
          body={t('cta.body')}
          primary={{ label: t('cta.primary'), href: localeHref(locale, '/signup') }}
        />
      </Section>
    </>
  );
}
