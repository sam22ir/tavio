import type { ReactNode } from 'react';
import { cn } from '@/ui/lib/cn';
import { Emphasis } from './Emphasis';
import { CtaLink } from './CtaLink';
import { PillLabel } from './PillLabel';
import type { SiteAction } from './types';

/**
 * Top-of-page hero: centred pill, headline, subtext, CTAs, then an optional visual below.
 * Mobile: single column. Desktop: the visual sits under the copy at full container width.
 */
export function Hero({
  eyebrow,
  title,
  subtitle,
  primary,
  secondary,
  visual,
  uppercase = true,
}: {
  eyebrow?: string;
  title: string;
  /** Keep it under about 20 words. */
  subtitle: string;
  primary: SiteAction;
  secondary?: SiteAction;
  visual?: ReactNode;
  /** Big hero titles are uppercase; Arabic is never uppercase. */
  uppercase?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-7 text-center">
      {eyebrow ? <PillLabel>{eyebrow}</PillLabel> : null}
      <h1 className={cn("s-h1 max-w-[16ch] text-balance", uppercase && "s-uppercase")}>
        <Emphasis text={title} />
      </h1>
      <p className="max-w-[58ch] text-[17px] leading-relaxed text-[color:var(--s-muted)] md:text-lg">{subtitle}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <CtaLink href={primary.href} label={primary.label} />
        {secondary ? <CtaLink href={secondary.href} label={secondary.label} variant="light" arrow={false} /> : null}
      </div>
      {visual ? <div className="mt-6 w-full min-w-0">{visual}</div> : null}
    </div>
  );
}
