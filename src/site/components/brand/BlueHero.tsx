import type { ReactNode } from 'react';
import { cn } from '@/ui/lib/cn';
import { Emphasis } from '../Emphasis';
import { PillLabel } from '../PillLabel';
import { Watermark } from './Watermark';

/**
 * Revora hero panel: brand gradient, Watermark, white text and an optional row of outlined chips.
 * `*word*` in title renders in sky. Headlines are uppercase unless `uppercase={false}` (Arabic is never uppercase).
 */
export function BlueHero({
  eyebrow,
  title,
  subtitle,
  chips,
  actions,
  uppercase = true,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  chips?: ReactNode[];
  actions?: ReactNode;
  uppercase?: boolean;
  className?: string;
}) {
  return (
    <section className={cn('s-blue-hero relative isolate overflow-hidden px-6 py-16 md:px-16 md:py-24', className)}>
      <Watermark />
      <div className="relative z-10 flex max-w-3xl flex-col items-start gap-6">
        {eyebrow ? <PillLabel>{eyebrow}</PillLabel> : null}
        <h1 className={cn('s-h1 text-balance text-white', uppercase && 's-uppercase')}>
          <Emphasis text={title} />
        </h1>
        {subtitle ? <p className="max-w-[56ch] text-[17px] leading-relaxed md:text-lg">{subtitle}</p> : null}
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
        {chips && chips.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {chips.map((chip, i) => (
              <li key={i} className="s-chip-outline">
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
