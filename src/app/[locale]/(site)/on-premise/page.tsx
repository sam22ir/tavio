import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Check, Database, Server, ShieldCheck, Sparkles } from 'lucide-react';
import { routing } from '@/i18n/routing';
import { localeHref } from '@/site/content/nav';
import { buildMetadata } from '@/site/seo';
import {
  PageHero,
  CtaBand,
  CtaLink,
  CurvedTimeline,
  Emphasis,
  Reveal,
  RevealItem,
  RevealList,
  Section,
} from '@/site/components';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'site_pricing.onPremise.meta' });
  return buildMetadata({ locale, path: '/on-premise', title: t('title'), description: t('description') });
}

/** Icons for the guarantee tiles, in message order. */
const GUARANTEE_ICONS = [Server, Database, Sparkles, ShieldCheck];

export default async function OnPremisePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('site_pricing.onPremise');
  const requirements = t.raw('requirements') as string[];
  const steps = t.raw('steps') as { title: string; body: string }[];
  const guarantees = t.raw('guarantees') as { title: string; body: string }[];
  const backups = t.raw('backups') as string[];
  const contactHref = localeHref(locale, '/contact');

  return (
    <>
<PageHero
          eyebrow={t('eyebrow')}
          title={t('title')}
          subtitle={t('body')}
          actions={<CtaLink href={contactHref} label={t('cta')} variant="light" />}
        />

      {/* Guarantees: a bento of four tiles. */}
      <Reveal>
        <Section>
          <div className="flex flex-col gap-12">
            <RevealList className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {guarantees.map((item, i) => {
                const Icon = GUARANTEE_ICONS[i] ?? ShieldCheck;
                return (
                  <RevealItem key={item.title} className="s-panel flex flex-col gap-5 p-7 md:p-9">
                    <span className="inline-flex size-11 items-center justify-center rounded-full bg-[var(--s-accent-soft)] text-[color:var(--s-accent)]">
                      <Icon size={20} strokeWidth={1.75} aria-hidden />
                    </span>
                    <h3 className="text-xl">{item.title}</h3>
                    <p className="leading-relaxed text-[color:var(--s-muted)]">{item.body}</p>
                  </RevealItem>
                );
              })}
            </RevealList>
          </div>
        </Section>
      </Reveal>

      {/* Install steps on the curved timeline. */}
      <Reveal>
        <Section tone="muted">
          <div className="flex flex-col gap-16">
            <h2 className="s-h2 max-w-2xl !text-[2.25rem] md:!text-[2.75rem]">
              <Emphasis text={t('stepsTitle')} />
            </h2>
            <CurvedTimeline steps={steps} />
          </div>
        </Section>
      </Reveal>

      {/* Requirements, backups and the legal note, side by side. */}
      <Reveal>
        <Section>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="s-panel flex flex-col gap-6 p-7 md:p-9">
              <h2 className="text-xl">{t('requirementsTitle')}</h2>
              <ul className="flex flex-col gap-4">
                {requirements.map((item) => (
                  <li key={item} className="flex gap-3 leading-relaxed">
                    <Check className="mt-1 size-4 shrink-0 text-[color:var(--s-accent)]" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="s-panel flex flex-col gap-6 p-7 md:p-9">
              <h2 className="text-xl">{t('backupsTitle')}</h2>
              <ul className="flex flex-col gap-4">
                {backups.map((item) => (
                  <li key={item} className="flex gap-3 leading-relaxed">
                    <Check className="mt-1 size-4 shrink-0 text-[color:var(--s-accent)]" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="s-panel flex flex-col gap-4 p-7 md:p-9">
              <h2 className="text-xl">{t('supportTitle')}</h2>
              <p className="leading-relaxed text-[color:var(--s-muted)]">{t('support')}</p>
            </div>
            <div className="flex flex-col gap-4 rounded-[28px] border border-dashed border-[color:var(--s-accent)] bg-[var(--s-accent-soft)] p-7 md:p-9">
              <p className="text-sm font-semibold text-[color:var(--s-accent)]">{t('legalTitle')}</p>
              <p className="text-[15px] leading-relaxed">{t('legal')}</p>
            </div>
          </div>
        </Section>
      </Reveal>

      <Reveal>
        <Section className="pt-0">
          <CtaBand
            title={t('ctaTitle')}
            body={t('ctaBody')}
            primary={{ label: t('cta'), href: contactHref }}
            secondary={{ label: t('pricingCta'), href: localeHref(locale, '/pricing') }}
          />
        </Section>
      </Reveal>
    </>
  );
}
