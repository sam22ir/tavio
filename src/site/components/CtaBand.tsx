import { CtaLink } from './CtaLink';
import { Emphasis } from './Emphasis';
import type { SiteAction } from './types';

/**
 * Closing call to action on a deep green band.
 * Mobile: stacked. Desktop: text and buttons side by side.
 */
export function CtaBand({ title, body, primary, secondary }: {
  title: string;
  body?: string;
  primary: SiteAction;
  secondary?: SiteAction;
}) {
  return (
    <div className="s-cta-band flex flex-col items-start justify-between gap-8 px-6 py-14 md:flex-row md:items-center md:px-14">
      <div className="flex max-w-2xl flex-col gap-3">
        <h2 className="s-h2 text-balance">
          <Emphasis text={title} />
        </h2>
        {body ? <p className="text-[17px] leading-relaxed text-white/80">{body}</p> : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <CtaLink href={primary.href} label={primary.label} variant="light" />
        {secondary ? <CtaLink href={secondary.href} label={secondary.label} variant="accent" arrow={false} /> : null}
      </div>
    </div>
  );
}
