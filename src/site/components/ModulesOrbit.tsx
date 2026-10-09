import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Centre mark with module chips on two concentric rings, all linking to their feature page.
 * Positions use inset-inline-start so they mirror in RTL. Desktop only: below md a wrapping list is shown instead.
 */
export function ModulesOrbit({ items, center }: { items: { href: string; title: string }[]; center: ReactNode }) {
  const inner = items.slice(0, 4);
  const outer = items.slice(4);
  const place = (list: typeof items, radius: number, offset: number) =>
    list.map((item, i) => {
      const angle = ((i / list.length) * 360 + offset) * (Math.PI / 180);
      const x = 50 + radius * Math.cos(angle);
      const y = 50 + radius * Math.sin(angle);
      return (
        <Link key={item.href} href={item.href} className="s-chip" style={{ insetInlineStart: `${x}%`, top: `${y}%` }}>
          <i aria-hidden />
          {item.title}
        </Link>
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
        {place(inner, 32, 45)}
        {place(outer, 46, 0)}
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
