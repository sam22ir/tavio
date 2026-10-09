import type { Metadata } from 'next';
import Link from 'next/link';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Check } from 'lucide-react';
import { routing } from '@/i18n/routing';
import { buildMetadata } from '@/site/seo';
import { localeHref } from '@/site/content/nav';
import { CtaBand, Section, SectionHeading, Steps } from '@/site/components';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'site_pricing.onPremise.meta' });
  return buildMetadata({ locale, path: '/on-premise', title: t('title'), description: t('description') });
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="mt-8 grid gap-4">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-base leading-relaxed">
          <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function OnPremisePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('site_pricing.onPremise');
  const requirements = t.raw('requirements') as string[];
  const steps = t.raw('steps') as { title: string; body: string }[];
  const backups = t.raw('backups') as string[];
  const included = t.raw('included') as string[];
  const contactHref = localeHref(locale, '/contact');

  return (
    <>
      <Section className="pt-12 md:pt-20">
        <div className="flex max-w-3xl flex-col gap-5">
          <h1 className="text-4xl font-semibold tracking-tighter md:text-6xl">{t('title')}</h1>
          <p className="max-w-[65ch] text-base leading-relaxed text-muted-foreground md:text-lg">{t('body')}</p>
          <p className="rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">{t('legal')}</p>
        </div>
      </Section>

      <Section tone="muted">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t('requirementsTitle')}</h2>
            <CheckList items={requirements} />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t('includedTitle')}</h2>
            <CheckList items={included} />
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading title={t('stepsTitle')} />
        <div className="mt-10">
          <Steps steps={steps} />
        </div>
      </Section>

      <Section tone="muted">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t('backupsTitle')}</h2>
            <CheckList items={backups} />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t('supportTitle')}</h2>
            <p className="mt-8 text-base leading-relaxed text-muted-foreground">{t('support')}</p>
            <p className="mt-6 text-sm">
              <Link href={localeHref(locale, '/pricing')} className="font-medium text-primary underline-offset-4 hover:underline">
                {t('pricingCta')}
              </Link>
            </p>
          </div>
        </div>
      </Section>

      <Section>
        <CtaBand
          title={t('ctaTitle')}
          body={t('ctaBody')}
          primary={{ label: t('cta'), href: contactHref }}
        />
      </Section>
    </>
  );
}
