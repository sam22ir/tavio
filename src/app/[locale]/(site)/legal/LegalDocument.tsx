import { getTranslations } from 'next-intl/server';

/** Shared layout for legal texts. Copy lives in site_company.json and is marked for lawyer review. */
export async function LegalDocument({ namespace }: { namespace: 'site_company.legal.privacy' | 'site_company.legal.terms' }) {
  const t = await getTranslations(namespace);
  const sections = t.raw('sections') as { title: string; body: string[] }[];

  return (
    <article className="mx-auto w-full max-w-3xl px-4 pt-12 pb-16 md:pt-20 md:pb-24">
      <header className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('updated')}</p>
        <p role="note" className="rounded-xl border border-border bg-muted/50 p-4 text-sm leading-relaxed">
          {t('review')}
        </p>
      </header>

      <div className="mt-12 flex flex-col gap-10">
        {sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="max-w-[65ch] leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
