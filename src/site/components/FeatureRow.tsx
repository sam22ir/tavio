import type { ReactNode } from 'react';

/**
 * Text beside a visual (mock-up or image). `reverse` swaps the sides on desktop.
 * Mobile: text first, visual below, always stacked.
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
    <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
      <div className={`flex flex-col gap-5 ${reverse ? 'md:order-2' : ''}`}>
        <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h3>
        <p className="leading-relaxed text-muted-foreground">{body}</p>
        {bullets.length > 0 ? (
          <ul className="flex flex-col gap-2 text-sm">
            {bullets.map((b) => (
              <li key={b} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className={`min-w-0 ${reverse ? 'md:order-1' : ''}`}>{visual}</div>
    </div>
  );
}
