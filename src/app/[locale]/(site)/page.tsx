import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { SAAS_PLAN_SEED } from '@/modules/subscriptions/plans';
import { routing } from '@/i18n/routing';
import { localeHref } from '@/site/content/nav';
import {
  CtaBand,
  Faq,
  FeatureGrid,
  FeatureRow,
  Hero,
  MockScreen,
  PricingCards,
  Section,
  SectionHeading,
  Steps,
  type PricingPlan,
} from '@/site/components';

export const dynamic = 'force-dynamic';

/** Formats a whole-DZD amount with thin-space thousands separators. */
function formatDzd(amount: number): string {
  return `${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} DZD`;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'site.home.meta' });
  return { title: t('title'), description: t('description') };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('site.home');

  const pain = t.raw('pain.items') as { problem: string; solution: string }[];
  const modules = t.raw('modules.items') as { slug: string; title: string; body: string }[];
  const credit = modules.find((m) => m.slug === 'credit-sales');
  const algeria = t.raw('algeria.items') as { title: string; body: string }[];
  const how = t.raw('how.items') as { title: string; body: string }[];
  const faq = t.raw('faq.items') as { question: string; answer: string }[];
  const planFeatures = t.raw('pricing.features') as Record<string, string[]>;

  const plans: PricingPlan[] = SAAS_PLAN_SEED.map((plan) => {
    const dzd = Number(plan.pricePerUserCents / 100n);
    const isPro = plan.code === 'pro';
    return {
      name: plan.name,
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
      <Section className="pt-12 md:pt-20">
        <Hero
          title={t('hero.title')}
          subtitle={t('hero.subtitle')}
          primary={{ label: t('hero.primary'), href: localeHref(locale, '/signup') }}
          secondary={{ label: t('hero.secondary'), href: '#modules' }}
          visual={<MockScreen variant="dashboard" />}
        />
      </Section>

      <Section tone="muted">
        <SectionHeading title={t('pain.title')} />
        <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {pain.map((item) => (
            <li key={item.problem} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
              <p className="text-base font-medium text-muted-foreground line-through decoration-muted-foreground/50">
                {item.problem}
              </p>
              <p className="flex gap-2 text-base leading-relaxed">
                <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                <span>{item.solution}</span>
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="modules">
        <SectionHeading title={t('modules.title')} body={t('modules.body')} />
        <div className="mt-10">
          <FeatureGrid
            items={modules.map((m, i) => ({
              title: m.title,
              body: m.body,
              href: localeHref(locale, `/features/${m.slug}`),
              featured: i === 2 || i === 5,
            }))}
          />
        </div>
      </Section>

      {credit ? (
        <Section>
          <FeatureRow title={credit.title} body={credit.body} visual={<MockScreen variant="installments" />} />
        </Section>
      ) : null}

      <Section tone="muted">
        <SectionHeading title={t('algeria.title')} body={t('algeria.body')} />
        <ul className="mt-10 grid grid-cols-1 gap-x-8 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
          {algeria.map((item) => (
            <li key={item.title} className="flex flex-col gap-2 border-t border-border pt-5">
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <SectionHeading title={t('how.title')} />
        <div className="mt-10">
          <Steps steps={how} />
        </div>
      </Section>

      <Section tone="muted">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{t('ai.title')}</h2>
          <p className="text-base leading-relaxed text-muted-foreground md:text-lg">{t('ai.body')}</p>
        </div>
      </Section>

      <Section>
        <SectionHeading title={t('pricing.title')} body={t('pricing.body')} />
        <div className="mt-10">
          <PricingCards plans={plans} />
        </div>
        <p className="mt-6 text-sm">
          <Link href={localeHref(locale, '/pricing')} className="font-medium text-primary underline-offset-4 hover:underline">
            {t('pricing.cta')}
          </Link>
        </p>
      </Section>

      <Section tone="muted">
        <SectionHeading title={t('faq.title')} />
        <div className="mt-10">
          <Faq items={faq} />
        </div>
      </Section>

      <Section>
        <CtaBand
          title={t('cta.title')}
          body={t('cta.body')}
          primary={{ label: t('cta.primary'), href: localeHref(locale, '/signup') }}
        />
      </Section>
    </>
  );
}
