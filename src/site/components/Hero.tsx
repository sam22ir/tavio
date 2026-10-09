import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/ui/primitives/button';
import type { SiteAction } from './types';

/**
 * Top-of-page hero: headline, short subtext, one primary and one optional secondary CTA.
 * `visual` is shown beside the text on desktop and below it on mobile.
 * Mobile: single column. Desktop: 2 columns.
 */
export function Hero({
  title,
  subtitle,
  primary,
  secondary,
  visual,
}: {
  title: string;
  /** Keep it under about 20 words. */
  subtitle: string;
  primary: SiteAction;
  secondary?: SiteAction;
  visual?: ReactNode;
}) {
  return (
    <div className="grid items-center gap-12 md:grid-cols-2">
      <div className="flex flex-col gap-6">
        <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight md:text-5xl lg:text-6xl">{title}</h1>
        <p className="max-w-[60ch] text-lg leading-relaxed text-muted-foreground">{subtitle}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={primary.href}>{primary.label}</Link>
          </Button>
          {secondary ? (
            <Button asChild variant="outline" size="lg">
              <Link href={secondary.href}>{secondary.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
      {visual ? <div className="min-w-0">{visual}</div> : null}
    </div>
  );
}
