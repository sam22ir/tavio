import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { localeHref } from '@/site/content/nav';
import { buildMetadata } from '@/site/seo';
import { CtaBand, Emphasis, PillLabel, Reveal, Section } from '@/site/components';
import { FaqFilter } from './FaqFilter';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'site_company.faq.meta' });
  return buildMetadata({ locale: locale as Locale, path: '/faq', title: t('title'), description: t('description') });
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('site_company.faq');

  const groups = t.raw('groups') as { title: string; items: { question: string; answer: string }[] }[];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-10 pt-14 md:pt-24">
        <div aria-hidden className="s-grid-bg pointer-events-none absolute inset-x-0 top-0 h-[70%]" />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <PillLabel>{t('eyebrow')}</PillLabel>
          <h1 className="s-h1 text-balance">
            <Emphasis text={t('title')} />
          </h1>
          <p className="max-w-[58ch] text-[17px] leading-relaxed text-[color:var(--s-muted)] md:text-lg">{t('body')}</p>
        </div>
      </section>

      <Reveal>
        <Section className="pt-8">
          <div className="mx-auto max-w-3xl">
            <FaqFilter groups={groups} allLabel={t('all')} />
          </div>
        </Section>
      </Reveal>

      <Reveal>
        <Section className="pt-0">
          <CtaBand
            title={t('cta.title')}
            body={t('cta.body')}
            primary={{ label: t('cta.primary'), href: localeHref(locale, '/contact') }}
          />
        </Section>
      </Reveal>
    </>
  );
}
