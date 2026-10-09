'use client';

import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls, type MotionValue } from 'motion/react';

/**
 * Centre mark with module chips on two concentric rings, all linking to their feature page.
 * The rings turn very slowly in opposite directions (chips counter-rotate so labels stay upright).
 * Hovering the orbit pauses it. Reduced motion: static. Desktop only: below md a wrapping list is shown.
 */
export function ModulesOrbit({ items, center }: { items: { href: string; title: string }[]; center: ReactNode }) {
  const reduce = useReducedMotion();
  const rot = useMotionValue(0);
  const rotBack = useTransform(rot, (v) => -v);
  const controls = useRef<AnimationPlaybackControls | null>(null);

  useEffect(() => {
    if (reduce) return;
    const c = animate(rot, 360, { duration: 240, ease: 'linear', repeat: Infinity });
    controls.current = c;
    return () => c.stop();
  }, [reduce, rot]);

  const inner = items.slice(0, 4);
  const outer = items.slice(4);
  const place = (list: typeof items, radius: number, offset: number, counter: MotionValue<number>) =>
    list.map((item, i) => {
      const angle = ((i / list.length) * 360 + offset) * (Math.PI / 180);
      const x = 50 + radius * Math.cos(angle);
      const y = 50 + radius * Math.sin(angle);
      return (
        <motion.div
          key={item.href}
          className="absolute size-0"
          style={{ insetInlineStart: `${x}%`, top: `${y}%`, rotate: reduce ? 0 : counter }}
        >
          <Link href={item.href} className="s-chip" onMouseEnter={() => controls.current?.pause()} onMouseLeave={() => controls.current?.play()}>
            <i aria-hidden />
            {item.title}
          </Link>
        </motion.div>
      );
    });

  return (
    <>
      <div className="relative mx-auto hidden aspect-square w-full max-w-[640px] md:block">
        <div className="s-ring inset-[18%]" aria-hidden />
        <div className="s-ring inset-[4%]" aria-hidden />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="s-panel flex size-40 items-center justify-center rounded-full">{center}</div>
        </div>
        <motion.div className="absolute inset-0" style={reduce ? undefined : { rotate: rot }}>
          {place(inner, 32, 45, rotBack)}
        </motion.div>
        <motion.div className="absolute inset-0" style={reduce ? undefined : { rotate: rotBack }}>
          {place(outer, 46, 0, rot)}
        </motion.div>
      </div>
      <ul className="flex flex-wrap justify-center gap-2 md:hidden">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="s-chip s-chip-static">
              <i aria-hidden />
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
