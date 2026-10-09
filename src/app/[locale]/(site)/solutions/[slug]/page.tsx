import type { Metadata } from 'next';
import Link from 'next/link';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { routing } from '@/i18n/routing';
import { buildMetadata, SOLUTION_SLUGS } from '@/site/seo';
import { localeHref } from '@/site/content/nav';
import {
  isSolutionSlug,
  SOLUTION_SEEDS,
  type SolutionModuleKey,
  type SolutionSlug,
} from '@/site/content/solutions';
import {
  ConnectorDiagram,
  CtaBand,
  CtaLink,
  DeviceFrame,
  Emphasis,
  FeatureList,
  PillLabel,
  Reveal,
  Section,
} from '@/site/components';

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => SOLUTION_SLUGS.map((slug) => ({ locale, slug })));
}

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale) || !isSolutionSlug(slug)) return {};
  const t = await getTranslations({ locale, namespace: `site_pricing.solutions.items.${slug}` });
  return buildMetadata({
    locale,
    path: `/solutions/${slug}`,
    title: `${t('title')} | Tavio`,
    description: t('short'),
  });
}

export default async function SolutionPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale) || !isSolutionSlug(slug)) notFound();
  setRequestLocale(locale);
  const seed = SOLUTION_SEEDS[slug as SolutionSlug];
  const t = await getTranslations('site_pricing.solutions');
  const item = (key: string) => t(`items.${slug}.${key}`);
  const modules = t.raw(`items.${slug}.modules`) as SolutionModuleKey[];
  const features = modules.map((key) => ({ title: t(`modules.${key}`), body: t(`moduleBodies.${key}`) }));
  const before = t.raw(`items.${slug}.before`) as string[];
  const after = t.raw(`items.${slug}.after`) as string[];
  const signupHref = localeHref(locale, '/signup');
  const related = SOLUTION_SLUGS.filter((s) => s !== slug);

  return (
    <>
      {/* Hero: pill, headline with the accent phrase, short intro and the two CTAs. */}
      <section className="relative overflow-hidden px-4 pb-16 pt-14 md:pb-20 md:pt-24">
        <div aria-hidden className="s-grid-bg pointer-events-none absolute inset-x-0 top-0 h-[80%]" />
        <div aria-hidden className="s-glow pointer-events-none absolute start-1/2 top-[14%] h-[440px] w-[min(680px,100%)] -translate-x-1/2 rounded-full" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-7 text-center">
          <PillLabel>{t('indexEyebrow')}</PillLabel>
          <h1 className="s-h1 max-w-[18ch] text-balance">
            <Emphasis text={item('headline')} />
          </h1>
          <p className="max-w-[58ch] text-[17px] leading-relaxed text-[color:var(--s-muted)] md:text-lg">{item('short')}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <CtaLink href={signupHref} label={t('cta')} />
            <CtaLink href={localeHref(locale, '/solutions')} label={t('seeAll')} variant="light" arrow={false} />
          </div>
        </div>
      </section>

      {/* Before and after: the paper-and-notebook version against the Tavio version. */}
      <Reveal>
        <Section tone="muted">
          <div className="flex flex-col gap-12">
            <div className="flex max-w-2xl flex-col gap-5">
              <h2 className="s-h2">
                <Emphasis text={t('problemTitle')} />
              </h2>
              <p className="text-[17px] leading-relaxed text-[color:var(--s-muted)]">{item('problem')}</p>
            </div>
            <ConnectorDiagram
              beforeLabel={t('beforeLabel')}
              afterLabel={t('afterLabel')}
              before={before}
              after={after}
              center={<span className="s-mark !size-14 !rounded-2xl !text-2xl">T</span>}
            />
          </div>
        </Section>
      </Reveal>

      {/* Screenshot of the most relevant screen, with the modules this business uses. */}
      <Reveal>
        <Section>
          <div className="grid items-center gap-12 md:grid-cols-2 md:gap-20">
            <div className="flex flex-col gap-6">
              <PillLabel>{t('modulesTitle')}</PillLabel>
              <h2 className="s-h2 !text-[2.25rem] md:!text-[2.75rem]">
                <Emphasis text={t('solutionTitle')} />
              </h2>
              <p className="text-[17px] leading-relaxed text-[color:var(--s-muted)]">{item('solution')}</p>
              <FeatureList items={features} />
            </div>
            <div className="min-w-0">
              <DeviceFrame name={seed.screen} locale={locale} alt={item('title')} />
            </div>
          </div>
        </Section>
      </Reveal>

      <Reveal>
        <Section tone="muted">
          <div className="flex flex-col gap-10">
            <h2 className="s-h2 !text-[2rem] md:!text-[2.5rem]">
              <Emphasis text={t('related')} />
            </h2>
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {related.map((s) => (
                <li key={s} className="h-full">
                  <Link
                    href={localeHref(locale, `/solutions/${s}`)}
                    className="s-panel group flex h-full flex-col gap-3 p-6 transition-transform duration-500 hover:-translate-y-1"
                  >
                    <span className="font-semibold">{t(`items.${s}.title`)}</span>
                    <span className="text-sm leading-relaxed text-[color:var(--s-muted)]">{t(`items.${s}.problemLine`)}</span>
                    <span className="mt-auto inline-flex items-center gap-2 pt-2 text-sm font-semibold text-[color:var(--s-accent)]">
                      {t('open')}
                      <ArrowRight size={16} strokeWidth={1.75} className="s-flip-rtl" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      </Reveal>

      <Reveal>
        <Section className="pt-0">
          <CtaBand
            title={t('ctaTitle')}
            body={t('ctaBody')}
            primary={{ label: t('cta'), href: signupHref }}
          />
        </Section>
      </Reveal>
    </>
  );
}
