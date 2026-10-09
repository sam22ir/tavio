import type { Metadata } from 'next';
import Link from 'next/link';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { buildMetadata, SOLUTION_SLUGS } from '@/site/seo';
import { localeHref } from '@/site/content/nav';
import {
  isSolutionSlug,
  SOLUTION_SEEDS,
  type SolutionModuleKey,
  type SolutionSlug,
} from '@/site/content/solutions';
import { CtaBand, FeatureRow, Hero, MockScreen, Section, SectionHeading } from '@/site/components';

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
  const moduleNames = modules.map((key) => t(`modules.${key}`));
  const signupHref = localeHref(locale, '/signup');
  const related = SOLUTION_SLUGS.filter((s) => s !== slug);

  return (
    <>
      <Section className="pt-12 md:pt-20">
        <Hero
          title={item('title')}
          subtitle={item('short')}
          primary={{ label: t('cta'), href: signupHref }}
          secondary={{ label: t('seeAll'), href: localeHref(locale, '/solutions') }}
          visual={<MockScreen variant={seed.variant} />}
        />
      </Section>

      <Section tone="muted">
        <SectionHeading title={t('problemTitle')} body={item('problem')} />
      </Section>

      <Section>
        <FeatureRow
          title={t('solutionTitle')}
          body={item('solution')}
          bullets={moduleNames}
          visual={<MockScreen variant={seed.secondaryVariant} />}
        />
      </Section>

      <Section tone="muted">
        <SectionHeading title={t('related')} />
        <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((s) => (
            <li key={s}>
              <Link
                href={localeHref(locale, `/solutions/${s}`)}
                className="flex h-full flex-col gap-2 rounded-2xl border border-border bg-card p-5 transition-colors duration-200 hover:border-primary/40"
              >
                <span className="font-semibold">{t(`items.${s}.title`)}</span>
                <span className="text-sm text-muted-foreground">{t(`items.${s}.short`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <CtaBand
          title={t('ctaTitle')}
          body={t('ctaBody')}
          primary={{ label: t('cta'), href: signupHref }}
        />
      </Section>
    </>
  );
}
