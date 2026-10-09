import { RevoraLogo } from '@/site/components/brand/RevoraLogo';
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
  PageHero,
  CtaBand,
  CtaLink,
  DeviceFrame,
  Emphasis,
  FeatureList,
  PillLabel,
  Reveal,
  Section,
} from '@/site/components';

/** Only the listed slugs exist; anything else is a 404 at build time. */
export const dynamicParams = false;

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
    title: `${t('title')} | Revora`,
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
<PageHero
          eyebrow={t('indexEyebrow')}
          title={item('headline')}
          subtitle={item('short')}
          actions={
            <>
              <CtaLink href={signupHref} label={t('cta')} variant="light" />
              <CtaLink href={localeHref(locale, '/solutions')} label={t('seeAll')} variant="light" arrow={false} />
            </>
          }
        />

      {/* Before and after: the paper-and-notebook version against the Revora version. */}
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
              center={<span className="inline-flex size-16 items-center justify-center rounded-2xl bg-white shadow-md"><RevoraLogo variant="mark" className="h-8 w-8" /></span>}
            />
          </div>
        </Section>
      </Reveal>

      {/* Revora platform and services: the method behind the software. */}
      <Reveal>
        <Section className="pt-0">
          <div className="s-panel grid gap-6 p-7 md:grid-cols-[1fr_auto] md:items-center md:p-10">
            <div className="flex flex-col gap-3">
              <h2 className="text-xl">{t('services.title')}</h2>
              <p className="leading-relaxed text-[color:var(--s-muted)]">{t('services.body')}</p>
            </div>
            <CtaLink href={localeHref(locale, '/services')} label={t('services.cta')} />
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
