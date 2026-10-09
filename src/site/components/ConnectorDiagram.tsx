import type { ReactNode } from 'react';

/**
 * Before/after diagram. Left column: "before" cards with a red cross. Centre: Tavio mark.
 * Right column: "after" cards with a green tick. SVG connectors are flipped under RTL.
 * Mobile: columns stack vertically and the connectors are hidden.
 */
export function ConnectorDiagram({
  before,
  after,
  beforeLabel,
  afterLabel,
  center,
}: {
  before: string[];
  after: string[];
  beforeLabel: string;
  afterLabel: string;
  center: ReactNode;
}) {
  const n = before.length;
  const ys = Array.from({ length: n }, (_, i) => ((i + 0.5) / n) * 100);
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-stretch">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="text-[13px] font-medium text-[color:var(--s-muted)]">{beforeLabel}</p>
        {before.map((text) => (
          <div key={text} className="s-panel flex items-center gap-3 px-5 py-4 text-[15px]">
            <span className="s-x" aria-hidden>✕</span>
            <span>{text}</span>
          </div>
        ))}
      </div>

      <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="s-flip-rtl hidden w-20 shrink-0 md:block">
        {ys.map((y) => (
          <path key={`b${y}`} d={`M0 ${y} C 50 ${y}, 50 50, 100 50`} className="s-connector-line" stroke="rgba(91,107,102,0.5)" />
        ))}
      </svg>

      <div className="flex shrink-0 items-center justify-center py-2 md:py-0">{center}</div>

      <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="s-flip-rtl hidden w-20 shrink-0 md:block">
        {ys.map((y) => (
          <path key={`a${y}`} d={`M0 50 C 50 50, 50 ${y}, 100 ${y}`} className="s-connector-line" stroke="#1f5f55" />
        ))}
      </svg>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="text-[13px] font-medium text-[color:var(--s-accent)]">{afterLabel}</p>
        {after.map((text) => (
          <div key={text} className="s-panel flex items-center gap-3 px-5 py-4 text-[15px]">
            <span className="s-check" aria-hidden>✓</span>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
