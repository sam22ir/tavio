import { getTranslations } from 'next-intl/server';
import { Emphasis } from '@/site/components';

/**
 * Shared layout for legal texts. The reading column is capped at ~70ch on a white panel.
 * A sticky table of contents sits beside it on desktop; on mobile it sits above the text.
 * Copy lives in site_company.json and is marked for lawyer review.
 */
export async function LegalDocument({ namespace }: { namespace: 'site_company.legal.privacy' | 'site_company.legal.terms' }) {
  const t = await getTranslations(namespace);
  const tCommon = await getTranslations('site_company.legal');
  const sections = t.raw('sections') as { title: string; body: string[] }[];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-12 md:pt-20">
      <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
        <nav aria-label={tCommon('tocTitle')} className="lg:sticky lg:top-28 lg:self-start">
          <p className="mb-3 text-sm font-semibold text-[color:var(--s-muted)]">{tCommon('tocTitle')}</p>
          <ol className="flex flex-col gap-1 border-s border-[color:rgba(15,26,23,0.1)]">
            {sections.map((section, i) => (
              <li key={section.title}>
                <a
                  href={`#section-${i + 1}`}
                  className="-ms-px block border-s-2 border-transparent ps-4 py-1.5 text-[15px] text-[color:var(--s-muted)] transition-colors hover:border-[color:var(--s-accent)] hover:text-[color:var(--s-ink)]"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="s-panel mx-auto w-full max-w-[70ch] p-6 md:p-12">
          <header className="flex flex-col gap-5">
            <h1 className="s-h2">
              <Emphasis text={t('title')} />
            </h1>
            <p className="text-sm text-[color:var(--s-muted)]">{t('updated')}</p>
            <p role="note" className="rounded-2xl bg-[var(--s-accent-soft)] p-4 text-[15px] leading-relaxed text-[color:var(--s-ink)]">
              <span aria-hidden className="me-2">⚠</span>
              {t('review')}
            </p>
          </header>

          <div className="mt-12 flex flex-col gap-10">
            {sections.map((section, i) => (
              <section key={section.title} id={`section-${i + 1}`} className="flex scroll-mt-28 flex-col gap-3">
                <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="leading-[1.75] text-[color:var(--s-muted)]">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
