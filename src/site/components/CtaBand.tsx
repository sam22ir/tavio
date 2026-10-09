import Link from 'next/link';
import { Button } from '@/ui/primitives/button';
import type { SiteAction } from './types';

/**
 * Full-width closing call to action on a brand-tinted band.
 * Mobile: stacked. Desktop: text and buttons side by side.
 */
export function CtaBand({ title, body, primary, secondary }: {
  title: string;
  body?: string;
  primary: SiteAction;
  secondary?: SiteAction;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-8 rounded-3xl bg-primary px-6 py-12 text-primary-foreground md:flex-row md:items-center md:px-12">
      <div className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
        {body ? <p className="opacity-90">{body}</p> : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg" variant="secondary">
          <Link href={primary.href}>{primary.label}</Link>
        </Button>
        {secondary ? (
          <Button asChild size="lg" variant="outline">
            <Link href={secondary.href}>{secondary.label}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
