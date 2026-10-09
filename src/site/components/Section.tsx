import type { ReactNode } from 'react';
import { cn } from '@/ui/lib/cn';
import { Emphasis } from './Emphasis';
import { PillLabel } from './PillLabel';

/**
 * Page section wrapper: generous vertical rhythm, page-width container.
 * Mobile: single column with a 16px gutter (px-4). Sections fade up on scroll (see site.css).
 */
export function Section({
  id,
  tone = 'default',
  className,
  children,
}: {
  /** Anchor id, for in-page links. */
  id?: string;
  /** `muted` adds a slightly darker cream band. */
  tone?: 'default' | 'muted';
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn('overflow-x-clip px-4 py-20 md:py-32', tone === 'muted' && 'bg-muted/60', className)}>
      <div className="mx-auto w-full min-w-0 max-w-6xl">{children}</div>
    </section>
  );
}

/**
 * Section headline with optional pill label and body. Left aligned.
 * `*word*` in title renders in the emphasis style.
 */
export function SectionHeading({
  title,
  body,
  eyebrow,
  as: Tag = 'h2',
  uppercase = true,
}: {
  title: string;
  body?: string;
  eyebrow?: string;
  as?: 'h1' | 'h2';
  /** Big section titles are uppercase; Arabic is never uppercase. */
  uppercase?: boolean;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      {eyebrow ? <PillLabel>{eyebrow}</PillLabel> : null}
      <Tag className={cn("s-h2", uppercase && "s-uppercase")}>
        <Emphasis text={title} />
      </Tag>
      {body ? <p className="text-[17px] leading-relaxed text-[color:var(--s-muted)] md:text-lg">{body}</p> : null}
    </div>
  );
}
