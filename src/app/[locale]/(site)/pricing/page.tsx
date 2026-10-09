import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Check, Banknote, ClipboardCheck, GraduationCap, Landmark, LifeBuoy, Mailbox, Minus, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { SAAS_PLAN_SEED, type SaasPlanSeed } from '@/modules/subscriptions/plans';
import { routing } from '@/i18n/routing';
import { buildMetadata } from '@/site/seo';
import { localeHref } from '@/site/content/nav';
import {
  BlueHero,
  CtaBand,
  Emphasis,
  Faq,
  Reveal,
  Section,
  type PricingPlan,
} from '@/site/components';
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

/** Payment method icons, in the order of `pricing.payment.items`. */
const PAYMENT_ICONS = [Mailbox, Landmark, Banknote];

/** Icons for the services on quote band, in `pricing.services.items` order. */
const SERVICE_ICONS = [ClipboardCheck, Settings2, GraduationCap, LifeBuoy];

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
  const tHome = await getTranslations('site.home');

  const moduleLabel = (key: SolutionModuleKey) => t(`solutions.modules.${key}`);
  const signupHref = localeHref(locale, '/signup');
  const planFeatures = tHome.raw('pricing.features') as Record<string, string[]>;

  const buildPlans = (plan: SaasPlanSeed, period: 'monthly' | 'yearly'): PricingPlan => {
    const monthlyDzd = Number(plan.pricePerUserCents / 100n);
    const dzd = period === 'monthly' ? monthlyDzd : monthlyDzd * 10;
    const isPro = plan.code === 'pro';
    return {
      name: tHome(`pricing.planNames.${plan.code}`),
      price: dzd === 0 ? t('pricing.free') : formatDzd(dzd),
      period: dzd === 0 ? '' : t(period === 'monthly' ? 'pricing.perUserMonth' : 'pricing.perUserYear'),
      users: t('pricing.usersLimit', { count: plan.maxUsers }),
      features: planFeatures[plan.code] ?? [],
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
  const serviceItems = t.raw('pricing.services.items') as { title: string; body: string }[];

  return (
    <>
<BlueHero uppercase={locale !== 'ar'} eyebrow={t('pricing.eyebrow')} title={t('pricing.title')} subtitle={t('pricing.body')} />

      {/* Plans: monthly / yearly toggle and the plan cards. */}
      <Section className="pt-10 md:pt-14">
        <PricingToggle
          monthly={monthly}
          yearly={yearly}
          labels={{ monthly: t('pricing.monthly'), yearly: t('pricing.yearly'), badge: t('pricing.yearlyBadge'), save: t('pricing.yearlySave') }}
        />
        <p className="mt-8 text-center text-sm text-[color:var(--s-muted)]">{t('pricing.indicative')}</p>
      </Section>

      {/* Comparison: a white panel with hairline rows and soft green ticks. */}
      <Reveal>
        <Section tone="muted">
          <div className="flex flex-col gap-10">
            <h2 className="s-h2 !text-[2.25rem] md:!text-[2.75rem]">
              <Emphasis text={t('pricing.compareTitle')} />
            </h2>
            <div className="s-panel overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-start text-[15px]">
                <caption className="sr-only">{t('pricing.compareCaption')}</caption>
                <thead>
                  <tr className="border-b border-[rgba(15,26,23,0.08)]">
                    <th scope="col" className="p-5 text-start text-sm font-medium text-[color:var(--s-muted)]">
                      {t('pricing.compareFeature')}
                    </th>
                    {SAAS_PLAN_SEED.map((plan) => (
                      <th key={plan.code} scope="col" className="p-5 text-start text-base font-semibold">
                        {tHome(`pricing.planNames.${plan.code}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[rgba(15,26,23,0.08)]">
                    <th scope="row" className="p-5 text-start font-medium">
                      {t('pricing.compareUsers')}
                    </th>
                    {SAAS_PLAN_SEED.map((plan) => (
                      <td key={plan.code} className="p-5 tabular-nums text-[color:var(--s-muted)]">
                        {t('pricing.usersLimit', { count: plan.maxUsers })}
                      </td>
                    ))}
                  </tr>
                  {ROWS.map((row) => (
                    <tr key={row.key} className="border-b border-[rgba(15,26,23,0.08)] last:border-0">
                      <th scope="row" className="p-5 text-start font-medium">
                        {moduleLabel(row.key)}
                      </th>
                      {SAAS_PLAN_SEED.map((plan) => {
                        const has = plan.modules.includes(row.moduleId);
                        return (
                          <td key={plan.code} className="p-5">
                            {has ? (
                              <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#E3EFEA] text-[#1F5F55]">
                                <Check className="size-4" strokeWidth={2} aria-label={t('pricing.yes')} />
                              </span>
                            ) : (
                              <Minus className="size-4 text-[color:var(--s-muted)]" aria-label={t('pricing.no')} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      </Reveal>

      {/* Services on quote: audit, setup, training and support, linked to the services page. */}
      <Reveal>
        <Section tone="muted">
          <div className="flex flex-col gap-12">
            <div className="flex max-w-2xl flex-col gap-5">
              <h2 className="s-h2 !text-[2.25rem] md:!text-[2.75rem]">
                <Emphasis text={t('pricing.services.title')} />
              </h2>
              <p className="text-[17px] leading-relaxed text-[color:var(--s-muted)]">{t('pricing.services.body')}</p>
            </div>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {serviceItems.map((item, i) => {
                const Icon = SERVICE_ICONS[i] ?? ClipboardCheck;
                return (
                  <li key={item.title} className="s-panel flex flex-col gap-5 p-7">
                    <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--s-accent-soft)] text-[color:var(--s-accent)]">
                      <Icon size={20} strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="flex flex-col gap-2">
                      <h3 className="text-xl">{item.title}</h3>
                      <p className="leading-relaxed text-[color:var(--s-muted)]">{item.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Link href={localeHref(locale, '/services')} className="s-btn s-btn-dark w-fit rounded-full px-6 py-3 text-sm font-medium">
              {t('pricing.services.cta')}
            </Link>
          </div>
        </Section>
      </Reveal>

      {/* Payment methods as icon chips. */}
      <Reveal>
        <Section>
          <div className="flex flex-col gap-12">
            <div className="flex max-w-2xl flex-col gap-5">
              <h2 className="s-h2 !text-[2.25rem] md:!text-[2.75rem]">
                <Emphasis text={t('pricing.payment.title')} />
              </h2>
              <p className="text-[17px] leading-relaxed text-[color:var(--s-muted)]">{t('pricing.payment.body')}</p>
            </div>
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {payment.map((item, i) => {
                const Icon = PAYMENT_ICONS[i] ?? Banknote;
                return (
                  <li key={item.title} className="s-panel flex flex-col gap-5 p-7 md:p-8">
                    <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--s-accent-soft)] text-[color:var(--s-accent)]">
                      <Icon size={20} strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="flex flex-col gap-2">
                      <h3 className="text-xl">{item.title}</h3>
                      <p className="leading-relaxed text-[color:var(--s-muted)]">{item.body}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </Section>
      </Reveal>

      <Reveal>
        <Section tone="muted">
          <div className="grid gap-12 md:grid-cols-[1fr_1.4fr] md:gap-20">
            <h2 className="s-h2 !text-[2.25rem] md:!text-[2.75rem]">
              <Emphasis text={t('pricing.faq.title')} />
            </h2>
            <Faq items={faq} />
          </div>
        </Section>
      </Reveal>

      <Reveal>
        <Section className="pt-0">
          <CtaBand
            title={t('pricing.bottomCta.title')}
            body={t('pricing.bottomCta.body')}
            primary={{ label: t('pricing.cta'), href: signupHref }}
          />
        </Section>
      </Reveal>
    </>
  );
}
