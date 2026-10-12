import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { TintIcon, type Tint } from '@/ui/blocks/tint';

/** White rounded panel with a heading row (title, optional count and action) over its content. */
export function Panel({
  title,
  count,
  action,
  children,
  className = '',
}: {
  title: string;
  count?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`app-panel flex min-w-0 flex-col gap-4 p-5 ${className}`}>
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {count ? <span className="text-sm text-muted">{count}</span> : null}
        {action}
      </header>
      {children}
    </section>
  );
}

/** One row of a "Needs you" style feed: tinted icon, title, subtitle, trailing meta. */
export function FeedRow({
  icon,
  tint,
  title,
  subtitle,
  meta,
  href,
}: {
  icon: LucideIcon;
  tint: Tint;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  href: string;
}) {
  return (
    <li>
      <Link href={href} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl p-2 transition-colors hover:bg-default/60">
        <TintIcon icon={icon} tint={tint} />
        <span className="flex min-w-[8rem] flex-1 flex-col">
          <span className="truncate text-sm font-medium">{title}</span>
          {subtitle ? <span className="truncate text-xs text-muted">{subtitle}</span> : null}
        </span>
        {meta ? <span className="ms-auto flex shrink-0 items-center gap-2 text-sm tabular-nums max-sm:order-last max-sm:w-full max-sm:ps-[3.25rem]">{meta}</span> : null}
        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted max-sm:ms-auto rtl:rotate-180" />
      </Link>
    </li>
  );
}
