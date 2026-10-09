'use client';

import { motion, useReducedMotion } from 'motion/react';

const EASE = [0.32, 0.72, 0, 1] as const;

/**
 * Steps set on a wave that runs in its own band above the step texts. The dotted path draws itself
 * when in view and the numbered markers pop in sequence. Desktop: wave band over three columns.
 * Mobile: a dashed vertical line on the start edge (mirrors in RTL).
 */
export function CurvedTimeline({ steps }: { steps: { title: string; body: string }[] }) {
  const reduce = useReducedMotion();
  const hidden = reduce ? false : 'hidden';
  return (
    <motion.div className="relative" initial={hidden} whileInView="show" viewport={{ once: true, margin: '0px 0px -15% 0px' }}>
      <svg
        aria-hidden
        viewBox="0 0 1000 80"
        preserveAspectRatio="none"
        className="s-flip-rtl pointer-events-none absolute inset-x-0 top-0 hidden h-20 w-full md:block"
      >
        <motion.path
          className="s-timeline-path"
          d="M0 40 Q 83 0 166.67 40 T 500 40 T 833.33 40 T 1000 40"
          variants={{ hidden: { pathLength: reduce ? 1 : 0 }, show: { pathLength: 1, transition: { duration: 1.6, ease: EASE } } }}
        />
      </svg>
      <div aria-hidden className="pointer-events-none absolute inset-y-5 start-[1.375rem] w-0 border-s-2 border-dashed border-[color:var(--s-accent)] md:hidden" />
      <ol className="relative grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
        {steps.map((step, i) => (
          <li key={step.title} className="relative flex flex-col gap-4 ps-16 md:ps-0">
            <motion.div
              className="absolute start-0 top-0 flex h-11 items-center md:static md:h-20 md:justify-center"
              variants={{
                hidden: { opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.4 },
                show: { opacity: 1, scale: 1, transition: { delay: 0.3 + i * 0.35, type: 'spring', stiffness: 380, damping: 22 } },
              }}
            >
              <span className="s-numeral">{i + 1}</span>
            </motion.div>
            <h3 className="text-xl">{step.title}</h3>
            <p className="leading-relaxed text-[color:var(--s-muted)]">{step.body}</p>
          </li>
        ))}
      </ol>
    </motion.div>
  );
}
