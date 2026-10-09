import type { Metadata } from 'next';
import { GraduationCap, LifeBuoy, Search, Settings2, type LucideIcon } from 'lucide-react';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { localeHref } from '@/site/content/nav';
import { buildMetadata } from '@/site/seo';
import {
  PageHero,
  CtaBand,
  CtaLink,
  CurvedTimeline,
  Emphasis,
  Faq,
  PillLabel,
  Reveal,
  RevealItem,
  RevealList,
  Section,
} from '@/site/components';

/** Icons for the four services and the four process steps, in message order. */
const SERVICE_ICONS: LucideIcon[] = [Search, Settings2, GraduationCap, LifeBuoy];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'site_services.meta' });
  return buildMetadata({ locale: locale as Locale, path: '/services', title: t('title'), description: t('description') });
}

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('site_services');

  const items = t.raw('services.items') as { title: string; body: string; outcomes: string[]; duration: string }[];
  const chips = t.raw('audience.chips') as string[];
  const steps = t.raw('process.steps') as { title: string; body: string }[];
  const faq = t.raw('faq.items') as { question: string; answer: string }[];

  return (
    <>
      <Reveal>
        <div className="px-4 pt-6 md:px-8 md:pt-10">
          <div className="mx-auto w-full max-w-6xl">
            <PageHero
              eyebrow={t('hero.pill')}
              title={t('hero.title')}
              subtitle={t('hero.subtitle')}
              actions={<CtaLink href={localeHref(locale, '/contact?type=audit')} label={t('hero.primary')} variant="light" />}
            />
          </div>
        </div>
      </Reveal>

      {/* Four services as big alternating rows. */}
      <Reveal>
        <Section>
          <div className="flex flex-col gap-10 md:gap-16">
            <div className="flex max-w-2xl flex-col gap-5">
              <PillLabel>{t('services.eyebrow')}</PillLabel>
              <h2 className="s-h2">
                <Emphasis text={t('services.title')} />
              </h2>
            </div>
            <RevealList as="ul" className="flex flex-col gap-6 md:gap-8">
              {items.map((item, i) => {
                const Icon = SERVICE_ICONS[i] ?? Settings2;
                return (
                  <RevealItem
                    key={item.title}
                    className={`s-panel flex flex-col gap-8 p-7 md:p-12 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} md:items-center md:gap-12`}
                  >
                    <div className="flex flex-1 flex-col gap-5">
                      <span className="inline-flex size-14 items-center justify-center rounded-full bg-[var(--s-accent-soft)] text-[color:var(--s-accent)]">
                        <Icon size={26} strokeWidth={1.75} aria-hidden />
                      </span>
                      <h3 className="text-3xl md:text-4xl">{item.title}</h3>
                      <p className="max-w-[55ch] text-[17px] leading-relaxed text-[color:var(--s-muted)]">{item.body}</p>
                      <p className="text-sm font-medium text-[color:var(--s-accent)]">
                        {t('services.durationLabel')} : {item.duration}
                      </p>
                    </div>
                    <ul className="flex flex-1 flex-col gap-4 rounded-[20px] bg-[var(--s-bg-alt)] p-6 md:p-8">
                      {item.outcomes.map((outcome) => (
                        <li key={outcome} className="flex items-start gap-3 leading-relaxed">
                          <span aria-hidden className="mt-2 size-2 flex-none rounded-full bg-[var(--s-accent)]" />
                          <span>{outcome}</span>
                        </li>
                      ))}
                    </ul>
                  </RevealItem>
                );
              })}
            </RevealList>
          </div>
        </Section>
      </Reveal>

      {/* Who is it for. */}
      <Reveal>
        <Section tone="muted">
          <div className="flex flex-col gap-10">
            <div className="flex max-w-2xl flex-col gap-5">
              <h2 className="s-h2">
                <Emphasis text={t('audience.title')} />
              </h2>
              <p className="text-[17px] leading-relaxed text-[color:var(--s-muted)] md:text-lg">{t('audience.body')}</p>
            </div>
            <ul className="flex flex-wrap gap-3">
              {chips.map((chip) => (
                <li key={chip} className="rounded-full border border-[color:var(--s-accent-soft)] bg-white px-5 py-2.5 font-medium text-[color:var(--s-accent)] shadow-[var(--s-shadow)]">
                  {chip}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      </Reveal>

      {/* How we work. */}
      <Reveal>
        <Section>
          <div className="flex flex-col gap-16">
            <div className="flex max-w-2xl flex-col gap-5">
              <PillLabel>{t('process.eyebrow')}</PillLabel>
              <h2 className="s-h2">
                <Emphasis text={t('process.title')} />
              </h2>
              <p className="text-[17px] leading-relaxed text-[color:var(--s-muted)] md:text-lg">{t('process.body')}</p>
            </div>
            <CurvedTimeline steps={steps} />
          </div>
        </Section>
      </Reveal>

      <Reveal>
        <Section tone="muted">
          <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:gap-16">
            <h2 className="s-h2">
              <Emphasis text={t('faq.title')} />
            </h2>
            <Faq items={faq} />
          </div>
        </Section>
      </Reveal>

      <Reveal>
        <Section>
          <CtaBand
            title={t('cta.title')}
            body={t('cta.body')}
            primary={{ label: t('cta.primary'), href: localeHref(locale, '/contact?type=audit') }}
            secondary={{ label: t('cta.secondary'), href: localeHref(locale, '/contact') }}
          />
        </Section>
      </Reveal>
    </>
  );
}
