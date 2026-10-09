import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { localeHref } from '@/site/content/nav';
import { buildMetadata } from '@/site/seo';
import { CtaBand, Section, SectionHeading } from '@/site/components';

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
  const roadmap = t.raw('roadmap.items') as string[];

  return (
    <>
      <Section className="pt-12 md:pt-20">
        <div className="flex max-w-3xl flex-col gap-6">
          <SectionHeading as="h1" title={t('title')} body={t('body')} />
        </div>
      </Section>

      <Section tone="muted">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t('principles.title')}</h2>
        <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {principles.map((item) => (
            <li key={item.title} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <div className="grid gap-12 md:grid-cols-[1fr_1.2fr] md:gap-16">
          <SectionHeading title={t('roadmap.title')} body={t('roadmap.body')} />
          <ul className="flex flex-col gap-4 border-s-2 border-primary ps-6">
            {roadmap.map((item) => (
              <li key={item} className="text-base leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
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
