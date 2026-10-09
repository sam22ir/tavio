import type { ReactNode } from 'react';
import { cn } from '@/ui/lib/cn';

/**
 * Page section wrapper: consistent vertical rhythm and a page-width container.
 * Mobile: single column, 16px gutter (px-4).
 */
export function Section({
  id,
  tone = 'default',
  className,
  children,
}: {
  /** Anchor id, for in-page links. */
  id?: string;
  /** `muted` adds a subtle tinted band. */
  tone?: 'default' | 'muted';
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn('px-4 py-16 md:py-24', tone === 'muted' && 'bg-muted/50', className)}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

/**
 * Section headline with an optional body. Stacked vertically (no split header).
 * Mobile: single column.
 */
export function SectionHeading({ title, body, as: Tag = 'h2' }: { title: string; body?: string; as?: 'h1' | 'h2' }) {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Tag className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</Tag>
      {body ? <p className="text-base leading-relaxed text-muted-foreground md:text-lg">{body}</p> : null}
    </div>
  );
}
