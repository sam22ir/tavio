'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const EASE = [0.32, 0.72, 0, 1] as const;

/**
 * Before/after diagram. Left column: "before" cards with a red cross. Centre: Tavio mark.
 * Right column: "after" cards with a green tick. When in view the SVG connectors draw themselves,
 * then the tick items pop in. SVG connectors are flipped under RTL. Mobile: stacked, connectors hidden.
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
  const reduce = useReducedMotion();
  const n = before.length;
  const ys = Array.from({ length: n }, (_, i) => ((i + 0.5) / n) * 100);
  const hidden = reduce ? false : 'hidden';
  const drawStart = 0.2;

  return (
    <motion.div
      className="flex flex-col gap-6 md:flex-row md:items-stretch"
      initial={hidden}
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -15% 0px' }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="text-[13px] font-medium text-[color:var(--s-muted)]">{beforeLabel}</p>
        {before.map((text, i) => (
          <motion.div key={text} variants={popIn(0.9 + i * 0.1, reduce)} className="s-panel flex items-center gap-3 px-5 py-4 text-[15px]">
            <span className="s-x" aria-hidden>✕</span>
            <span>{text}</span>
          </motion.div>
        ))}
      </div>

      <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="s-flip-rtl hidden w-20 shrink-0 md:block">
        {ys.map((y, i) => (
          <motion.path
            key={`b${y}`}
            d={`M0 ${y} C 50 ${y}, 50 50, 100 50`}
            className="s-connector-line"
            stroke="rgba(91,107,102,0.5)"
            variants={draw(drawStart + i * 0.05, reduce)}
          />
        ))}
      </svg>

      <div className="flex shrink-0 items-center justify-center py-2 md:py-0">{center}</div>

      <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="s-flip-rtl hidden w-20 shrink-0 md:block">
        {ys.map((y, i) => (
          <motion.path
            key={`a${y}`}
            d={`M0 50 C 50 50, 50 ${y}, 100 ${y}`}
            className="s-connector-line"
            stroke="#08409D"
            variants={draw(0.6 + i * 0.05, reduce)}
          />
        ))}
      </svg>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="text-[13px] font-medium text-[color:var(--s-accent)]">{afterLabel}</p>
        {after.map((text, i) => (
          <motion.div key={text} variants={popIn(1.1 + i * 0.12, reduce)} className="s-panel flex items-center gap-3 px-5 py-4 text-[15px]">
            <span className="s-check" aria-hidden>✓</span>
            <span>{text}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function draw(delay: number, reduce: boolean | null) {
  return {
    hidden: { pathLength: reduce ? 1 : 0 },
    show: { pathLength: 1, transition: { duration: 0.9, delay, ease: EASE } },
  };
}

function popIn(delay: number, reduce: boolean | null) {
  return {
    hidden: { opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.85 },
    show: { opacity: 1, scale: 1, transition: { delay, type: 'spring' as const, stiffness: 420, damping: 26 } },
  };
}
