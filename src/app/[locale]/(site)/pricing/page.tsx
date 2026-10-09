import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Check, Minus } from 'lucide-react';
import { SAAS_PLAN_SEED, type SaasPlanSeed } from '@/modules/subscriptions/plans';
import { routing } from '@/i18n/routing';
import { buildMetadata } from '@/site/seo';
import { localeHref } from '@/site/content/nav';
import { CtaBand, Faq, Section, SectionHeading, type PricingPlan } from '@/site/components';
import type { SolutionModuleKey } from '@/site/content/solutions';
import { PricingToggle } from './PricingToggle';

/** Comparison rows: one per module, mapped to the plan's module ids. */
const ROWS: { key: SolutionModuleKey; moduleId: string }[] = [
  { key: 'credit', moduleId: 'credit_sales' },
  { key: 'crm', moduleId: 'crm' },
  { key: 'invoicing', moduleId: 'invoicing' },
  { key: 'inventory', moduleId: 'inventory' },
  { key: 'pos', moduleId: 'pos' },
  { key: 'accounting', moduleId: 'accounting' },
  { key: 'hr', moduleId: 'hr' },
  { key: 'helpdesk', moduleId: 'projects' },
  { key: 'website', moduleId: 'website' },
  { key: 'platform', moduleId: 'platform' },
];

/** Formats a whole-DZD amount with space thousands separators. */
function formatDzd(amount: number): string {
  return `${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} DZD`;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'site_pricing.pricing.meta' });
  return buildMetadata({ locale, path: '/pricing', title: t('title'), description: t('description') });
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('site_pricing');

  const moduleLabel = (key: SolutionModuleKey) => t(`solutions.modules.${key}`);
  const signupHref = localeHref(locale, '/signup');

  const buildPlans = (plan: SaasPlanSeed, period: 'monthly' | 'yearly'): PricingPlan => {
    const monthlyDzd = Number(plan.pricePerUserCents / 100n);
    const dzd = period === 'monthly' ? monthlyDzd : monthlyDzd * 10;
    const included = ROWS.filter((row) => plan.modules.includes(row.moduleId)).map((row) => moduleLabel(row.key));
    const isPro = plan.code === 'pro';
    return {
      name: plan.name,
      price: dzd === 0 ? t('pricing.free') : formatDzd(dzd),
      period: dzd === 0 ? '' : t(period === 'monthly' ? 'pricing.perUserMonth' : 'pricing.perUserYear'),
      users: t('pricing.usersLimit', { count: plan.maxUsers }),
      features: included,
      href: signupHref,
      cta: t('pricing.cta'),
      highlighted: isPro,
      badge: isPro ? t('pricing.popular') : undefined,
    };
  };

  const monthly = SAAS_PLAN_SEED.map((p) => buildPlans(p, 'monthly'));
  const yearly = SAAS_PLAN_SEED.map((p) => buildPlans(p, 'yearly'));
  const payment = t.raw('pricing.payment.items') as { title: string; body: string }[];
  const faq = t.raw('pricing.faq.items') as { question: string; answer: string }[];

  return (
    <>
      <Section className="pt-12 md:pt-20">
        <div className="flex max-w-3xl flex-col gap-5">
          <h1 className="text-4xl font-semibold tracking-tighter md:text-6xl">{t('pricing.title')}</h1>
          <p className="max-w-[65ch] text-base leading-relaxed text-muted-foreground md:text-lg">{t('pricing.body')}</p>
          <p className="text-sm text-muted-foreground">{t('pricing.indicative')}</p>
        </div>
        <div className="mt-12">
          <PricingToggle
            monthly={monthly}
            yearly={yearly}
            labels={{ monthly: t('pricing.monthly'), yearly: t('pricing.yearly'), badge: t('pricing.yearlyBadge') }}
          />
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading title={t('pricing.compareTitle')} />
        <div className="mt-10 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[560px] border-collapse text-start text-sm">
            <caption className="sr-only">{t('pricing.compareCaption')}</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="p-4 text-start font-medium text-muted-foreground">
                  {t('pricing.compareFeature')}
                </th>
                {SAAS_PLAN_SEED.map((plan) => (
                  <th key={plan.code} scope="col" className="p-4 text-start font-semibold">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <th scope="row" className="p-4 text-start font-medium">
                  {t('pricing.compareUsers')}
                </th>
                {SAAS_PLAN_SEED.map((plan) => (
                  <td key={plan.code} className="p-4 tabular-nums">
                    {t('pricing.usersLimit', { count: plan.maxUsers })}
                  </td>
                ))}
              </tr>
              {ROWS.map((row) => (
                <tr key={row.key} className="border-b border-border last:border-0">
                  <th scope="row" className="p-4 text-start font-medium">
                    {moduleLabel(row.key)}
                  </th>
                  {SAAS_PLAN_SEED.map((plan) => {
                    const has = plan.modules.includes(row.moduleId);
                    return (
                      <td key={plan.code} className="p-4">
                        {has ? (
                          <Check className="size-4 text-primary" aria-label={t('pricing.yes')} />
                        ) : (
                          <Minus className="size-4 text-muted-foreground" aria-label={t('pricing.no')} />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section>
        <SectionHeading title={t('pricing.payment.title')} body={t('pricing.payment.body')} />
        <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {payment.map((item) => (
            <li key={item.title} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-6">
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="muted">
        <SectionHeading title={t('pricing.faq.title')} />
        <div className="mt-10">
          <Faq items={faq} />
        </div>
      </Section>

      <Section>
        <CtaBand
          title={t('pricing.bottomCta.title')}
          body={t('pricing.bottomCta.body')}
          primary={{ label: t('pricing.cta'), href: signupHref }}
        />
      </Section>
    </>
  );
}
