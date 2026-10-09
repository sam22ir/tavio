import type { ReactNode } from 'react';
import { Emphasis } from './Emphasis';
import { FeatureList } from './FeatureList';

/**
 * Text beside a visual. `reverse` swaps the sides on desktop.
 * Mobile: text first, visual below, always stacked. Bullets render as hairline rows.
 */
export function FeatureRow({
  title,
  body,
  bullets = [],
  visual,
  reverse = false,
}: {
  title: string;
  body: string;
  bullets?: string[];
  visual: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-12 md:grid-cols-2 md:gap-20">
      <div className={`flex flex-col gap-5 ${reverse ? 'md:order-2' : ''}`}>
        <h3 className="s-h2 !text-[2rem] md:!text-[2.5rem]">
          <Emphasis text={title} />
        </h3>
        <p className="text-[17px] leading-relaxed text-[color:var(--s-muted)]">{body}</p>
        {bullets.length > 0 ? <FeatureList items={bullets.map((b) => ({ title: b, body: '' }))} /> : null}
      </div>
      <div className={`min-w-0 ${reverse ? 'md:order-1' : ''}`}>{visual}</div>
    </div>
  );
}
