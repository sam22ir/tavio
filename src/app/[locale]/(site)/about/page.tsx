import type { Metadata } from 'next';
import { Banknote, Languages, ShieldCheck, Zap, type LucideIcon } from 'lucide-react';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { localeHref } from '@/site/content/nav';
import { buildMetadata } from '@/site/seo';
import { CtaBand, CurvedTimeline, Emphasis, PillLabel, Reveal, RevealItem, RevealList, Section } from '@/site/components';

/** Icons for the principles bento, in message order. */
const PRINCIPLE_ICONS: LucideIcon[] = [Languages, Zap, Banknote, ShieldCheck];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'site_company.about.meta' });
  return buildMetadata({ locale: locale as Locale, path: '/about', title: t('title'), description: t('description') });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('site_company.about');

  const principles = t.raw('principles.items') as { title: string; body: string }[];
  const steps = t.raw('roadmap.steps') as { title: string; body: string }[];

  return (
    <>
      {/* Hero: Emphasis headline over a soft glow and grid. */}
      <section className="relative overflow-hidden px-4 pb-16 pt-14 md:pb-24 md:pt-24">
        <div aria-hidden className="s-grid-bg pointer-events-none absolute inset-x-0 top-0 h-[70%]" />
        <div aria-hidden className="s-glow pointer-events-none absolute start-1/2 top-[10%] h-[420px] w-[640px] -translate-x-1/2 rounded-full" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-7 text-center">
          <PillLabel>{t('eyebrow')}</PillLabel>
          <h1 className="s-h1 text-balance">
            <Emphasis text={t('title')} />
          </h1>
          <p className="max-w-[58ch] text-[17px] leading-relaxed text-[color:var(--s-muted)] md:text-lg">{t('body')}</p>
        </div>
      </section>

      {/* Principles bento: the first tile is wide, the rest share the row. */}
      <Reveal>
        <Section className="pt-0">
          <div className="flex flex-col gap-12">
            <div className="flex max-w-2xl flex-col gap-5">
              <PillLabel>{t('principles.title')}</PillLabel>
            </div>
            <RevealList as="ul" className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {principles.map((item, i) => {
                const Icon = PRINCIPLE_ICONS[i] ?? Zap;
                return (
                  <RevealItem
                    key={item.title}
                    className={`s-panel flex flex-col justify-between gap-6 p-7 md:p-8 ${i === 0 ? 'md:col-span-2' : ''}`}
                  >
                    <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--s-accent-soft)] text-[color:var(--s-accent)]">
                      <Icon size={20} strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="flex flex-col gap-3">
                      <h3 className="text-xl">{item.title}</h3>
                      <p className="max-w-[55ch] leading-relaxed text-[color:var(--s-muted)]">{item.body}</p>
                    </div>
                  </RevealItem>
                );
              })}
            </RevealList>
          </div>
        </Section>
      </Reveal>

      {/* Where we're going: curved timeline. */}
      <Reveal>
        <Section tone="muted">
          <div className="flex flex-col gap-16">
            <div className="flex max-w-2xl flex-col gap-5">
              <PillLabel>{t('roadmap.eyebrow')}</PillLabel>
              <h2 className="s-h2">
                <Emphasis text={t('roadmap.title')} />
              </h2>
              <p className="text-[17px] leading-relaxed text-[color:var(--s-muted)] md:text-lg">{t('roadmap.body')}</p>
            </div>
            <CurvedTimeline steps={steps} />
          </div>
        </Section>
      </Reveal>

      <Reveal>
        <Section>
          <CtaBand
            title={t('cta.title')}
            body={t('cta.body')}
            primary={{ label: t('cta.primary'), href: localeHref(locale, '/signup') }}
          />
        </Section>
      </Reveal>
    </>
  );
}
