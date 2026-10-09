import type { ReactNode } from 'react';
import { Emphasis } from './Emphasis';
import { PillLabel } from './PillLabel';

/**
 * Page-top hero in the approved cream style: pill label, sentence-case headline with one `*accent*` word,
 * subtext, then optional actions. Left-aligned on desktop and start-aligned under RTL.
 */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="px-4 pt-10 md:pt-16">
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-6">
        {eyebrow ? <PillLabel>{eyebrow}</PillLabel> : null}
        <h1 className="s-h1 text-balance">
          <Emphasis text={title} />
        </h1>
        {subtitle ? <p className="max-w-[56ch] text-[17px] leading-relaxed text-[color:var(--s-muted)] md:text-lg">{subtitle}</p> : null}
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}
