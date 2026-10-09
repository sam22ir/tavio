import type { ReactNode } from 'react';
import Link from 'next/link';

export interface FeatureGridItem {
  title: string;
  body: string;
  href: string;
  icon?: ReactNode;
  /** Gives the card the accent tint for visual variety. */
  featured?: boolean;
}

/**
 * Grid of linked module cards on white panels.
 * Mobile: 1 column. Tablet: 2. Desktop: `columns` (default 4).
 */
export function FeatureGrid({ items, columns = 4 }: { items: FeatureGridItem[]; columns?: 2 | 3 | 4 }) {
  const cols = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-2 lg:grid-cols-3', 4: 'md:grid-cols-2 lg:grid-cols-4' }[columns];
  return (
    <ul className={`grid grid-cols-1 gap-4 ${cols}`}>
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className={`s-panel flex h-full flex-col gap-3 p-6 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 ${
              item.featured ? 'bg-[var(--s-accent-soft)]' : ''
            }`}
          >
            {item.icon ? <span className="text-[color:var(--s-accent)]">{item.icon}</span> : null}
            <span className="text-lg font-bold tracking-tight">{item.title}</span>
            <span className="text-[15px] leading-relaxed text-[color:var(--s-muted)]">{item.body}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
