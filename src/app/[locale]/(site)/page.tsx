import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, Boxes, ClipboardCheck, Cpu, GraduationCap, Handshake, LifeBuoy, Megaphone, Settings, type LucideIcon } from 'lucide-react';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { SAAS_PLAN_SEED } from '@/modules/subscriptions/plans';
import { routing } from '@/i18n/routing';
import { localeHref } from '@/site/content/nav';
import { RevoraLogo } from '@/site/components/brand/RevoraLogo';
import {
  ConnectorDiagram,
  CtaBand,
  CtaLink,
  CurvedTimeline,
  DeviceFrame,
  Emphasis,
  Faq,
  FeatureList,
  ModulesOrbit,
  Parallax,
  PillLabel,
  PricingCards,
  Reveal,
  RevealItem,
  RevealList,
  Section,
  type PricingPlan,
} from '@/site/components';

export const dynamic = 'force-dynamic';

/** Pillar icons, in message order. */
const PILLAR_ICONS: LucideIcon[] = [Megaphone, Handshake, Boxes, BarChart3, Cpu];
/** Service icons, in message order. */
const SERVICE_ICONS: LucideIcon[] = [ClipboardCheck, Settings, GraduationCap, LifeBuoy];

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

type Row = { eyebrow: string; title: string; body: string; screen: string; items: { title: string; body: string }[] };

/** Section heading with a pill label, shared by the sections below. */
function SectionTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <PillLabel>{eyebrow}</PillLabel>
      <h2 className="s-h2">
        <Emphasis text={title} />
      </h2>
      {body ? <p className="text-[17px] leading-relaxed text-[color:var(--s-muted)] md:text-lg">{body}</p> : null}
    </div>
  );
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('site.home');

  const pillars = t.raw('pillars.items') as { slug: string; title: string; body: string; modules: string[] }[];
  const method = t.raw('method.steps') as { title: string; body: string }[];
  const rows = t.raw('platform.rows') as Row[];
  const orbit = t.raw('orbit.items') as { slug: string; title: string }[];
  const points = t.raw('builders.points') as { title: string; body: string }[];
  const services = t.raw('services.items') as { title: string; body: string }[];
  const faq = t.raw('faq.items') as { question: string; answer: string }[];
  const withoutItems = t.raw('contrast.withoutItems') as string[];
  const withItems = t.raw('contrast.withItems') as string[];
  const planFeatures = t.raw('pricing.features') as Record<string, string[]>;

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
      cta: t('pricing.planCta'),
      highlighted: isPro,
      badge: isPro ? t('pricing.popular') : undefined,
    };
  });

  return (
    <>
      {/* Hero: cream, pill label, sentence-case headline with one serif accent word, then the screenshots. */}
      <section className="px-4 pt-10 md:pt-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-10">
          <div className="flex max-w-3xl flex-col items-start gap-6">
            <PillLabel>{t('hero.pill')}</PillLabel>
            <h1 className="s-h1 text-balance">
              <Emphasis text={t('hero.title')} />
            </h1>
            <p className="max-w-[56ch] text-[17px] leading-relaxed text-[color:var(--s-muted)] md:text-lg">{t('hero.subtitle')}</p>
            <div className="flex flex-wrap items-center gap-3">
              <CtaLink href={localeHref(locale, '/contact?type=audit')} label={t('hero.primary')} />
              <CtaLink href={localeHref(locale, '/features/platform')} label={t('hero.secondary')} variant="light" arrow={false} />
            </div>
            <ul className="flex flex-wrap gap-2">
              {(t.raw('hero.chips') as string[]).map((chip) => (
                <li key={chip} className="s-chip-outline">
                  {chip}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mt-4 w-full pb-12 md:pb-16">
            <Parallax distance={24} className="hidden w-full md:block">
              <DeviceFrame name="dashboard" locale={locale} device="laptop" priority className="w-full" />
            </Parallax>
            <Parallax distance={70} className="mx-auto w-[72%] max-w-[300px] md:absolute md:-bottom-10 md:end-2 md:w-[24%] md:max-w-[230px]">
              <DeviceFrame name="phone-dashboard" locale={locale} device="phone" priority />
            </Parallax>
          </div>
        </div>
      </section>

      {/* Without and with Revora: two panels, muted grey versus white with a blue border. */}
      <Reveal><Section>
        <div className="flex flex-col gap-12">
          <SectionTitle eyebrow={t('contrast.eyebrow')} title={t('contrast.title')} />
          <ConnectorDiagram
            before={withoutItems}
            after={withItems}
            beforeLabel={t('contrast.withoutTitle')}
            afterLabel={t('contrast.withTitle')}
            center={<span className="grid size-16 place-items-center rounded-2xl bg-white shadow-md"><RevoraLogo variant="mark" tone="blue" className="h-8 w-auto" /></span>}
          />
        </div>
      </Section></Reveal>

      {/* The five pillars, each linking to the module page that serves it. */}
      <Reveal><Section tone="muted">
        <div className="flex flex-col gap-12">
          <SectionTitle eyebrow={t('pillars.eyebrow')} title={t('pillars.title')} body={t('pillars.body')} />
          <RevealList className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            {pillars.map((pillar, i) => {
              const Icon = PILLAR_ICONS[i] ?? Megaphone;
              return (
                <RevealItem key={pillar.slug + pillar.title} className="h-full">
                  <Link
                    href={localeHref(locale, `/features/${pillar.slug}`)}
                    className="s-panel group flex h-full flex-col gap-4 p-6 transition hover:-translate-y-1"
                  >
                    <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--s-accent-soft)] text-[color:var(--s-accent)]">
                      <Icon size={20} strokeWidth={1.75} aria-hidden />
                    </span>
                    <h3 className="text-xl">{pillar.title}</h3>
                    <p className="text-[15px] leading-relaxed text-[color:var(--s-muted)]">{pillar.body}</p>
                    <ul className="mt-auto flex flex-col gap-1.5 border-t border-[rgba(8,64,157,0.12)] pt-4 text-[14px]">
                      {pillar.modules.map((module) => (
                        <li key={module}>{module}</li>
                      ))}
                    </ul>
                  </Link>
                </RevealItem>
              );
            })}
          </RevealList>
        </div>
      </Section></Reveal>

      {/* Our method: curved timeline. */}
      <Reveal><Section>
        <div className="flex flex-col gap-16">
          <SectionTitle eyebrow={t('method.eyebrow')} title={t('method.title')} />
          <CurvedTimeline steps={method} />
        </div>
      </Section></Reveal>

      {/* The platform: two screenshot rows with short feature lists, then the modules orbit. */}
      <Reveal><Section tone="muted">
        <div className="flex flex-col gap-24">
          <div className="flex max-w-2xl flex-col gap-5">
            <PillLabel>{t('platform.eyebrow')}</PillLabel>
            <h2 className="s-h2">
              <Emphasis text={t('platform.title')} />
            </h2>
            <p className="text-[17px] leading-relaxed text-[color:var(--s-muted)] md:text-lg">{t('platform.body')}</p>
          </div>
          {rows.map((row, i) => (
            <div key={row.screen} className="grid items-center gap-12 md:grid-cols-2 md:gap-20">
              <div className={`flex flex-col gap-6 ${i % 2 === 1 ? 'md:order-2' : ''}`}>
                <PillLabel>{row.eyebrow}</PillLabel>
                <h3 className="s-h2 !text-[2rem] md:!text-[2.5rem]">
                  <Emphasis text={row.title} />
                </h3>
                <p className="text-[17px] leading-relaxed text-[color:var(--s-muted)]">{row.body}</p>
                <FeatureList items={row.items} />
              </div>
              <div className={`min-w-0 ${i % 2 === 1 ? 'md:order-1' : ''}`}>
                <DeviceFrame name={row.screen} locale={locale} alt={row.title.replace(/\*/g, '')} />
              </div>
            </div>
          ))}
        </div>
      </Section></Reveal>

      <Reveal><Section id="modules">
        <div className="flex flex-col items-center gap-14">
          <SectionTitle eyebrow={t('orbit.eyebrow')} title={t('orbit.title')} body={t('orbit.body')} />
          <ModulesOrbit
            items={orbit.map((m) => ({ title: m.title, href: localeHref(locale, `/features/${m.slug}`) }))}
            center={<span className="grid size-14 place-items-center rounded-2xl bg-white shadow-md"><RevoraLogo variant="mark" tone="blue" className="h-8 w-auto" /></span>}
          />
        </div>
      </Section></Reveal>

      {/* Built by practitioners: no people, no logos, no counts. */}
      <Reveal><Section tone="muted">
        <div className="grid gap-12 md:grid-cols-[1fr_1fr] md:gap-20">
          <SectionTitle eyebrow={t('builders.eyebrow')} title={t('builders.title')} body={t('builders.body')} />
          <RevealList className="flex flex-col gap-4">
            {points.map((point) => (
              <RevealItem key={point.title} className="s-panel flex flex-col gap-2 p-6">
                <h3 className="text-xl">{point.title}</h3>
                <p className="leading-relaxed text-[color:var(--s-muted)]">{point.body}</p>
              </RevealItem>
            ))}
          </RevealList>
        </div>
      </Section></Reveal>

      {/* Services teaser. */}
      <Reveal><Section>
        <div className="flex flex-col gap-12">
          <SectionTitle eyebrow={t('services.eyebrow')} title={t('services.title')} body={t('services.body')} />
          <RevealList className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {services.map((service, i) => {
              const Icon = SERVICE_ICONS[i] ?? ClipboardCheck;
              return (
                <RevealItem key={service.title} className="s-panel flex h-full flex-col gap-4 p-7">
                  <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--s-accent-soft)] text-[color:var(--s-accent)]">
                    <Icon size={20} strokeWidth={1.75} aria-hidden />
                  </span>
                  <h3 className="text-xl">{service.title}</h3>
                  <p className="leading-relaxed text-[color:var(--s-muted)]">{service.body}</p>
                </RevealItem>
              );
            })}
          </RevealList>
          <div>
            <CtaLink href={localeHref(locale, '/services')} label={t('services.cta')} variant="light" />
          </div>
        </div>
      </Section></Reveal>

      {/* Pricing teaser: indicative prices. */}
      <Reveal><Section tone="muted">
        <div className="flex flex-col gap-12">
          <SectionTitle eyebrow={t('pricing.eyebrow')} title={t('pricing.title')} body={t('pricing.body')} />
          <PricingCards plans={plans} />
          <div>
            <CtaLink href={localeHref(locale, '/pricing')} label={t('pricing.cta')} variant="light" />
          </div>
        </div>
      </Section></Reveal>

      <Reveal><Section>
        <div className="grid gap-12 md:grid-cols-[1fr_1.4fr] md:gap-20">
          <SectionTitle eyebrow={t('faq.eyebrow')} title={t('faq.title')} />
          <Faq items={faq} />
        </div>
      </Section></Reveal>

      {/* Final CTA: Revora blue band. */}
      <Reveal><section className="px-4 pb-24 md:pb-32">
        <CtaBand
          title={t('cta.title')}
          body={t('cta.body')}
          primary={{ href: localeHref(locale, '/contact?type=audit'), label: t('cta.primary') }}
        />
      </section></Reveal>
    </>
  );
}
