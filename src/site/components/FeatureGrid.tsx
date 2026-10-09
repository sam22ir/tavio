import type { ReactNode } from 'react';
import Link from 'next/link';

export interface FeatureGridItem {
  title: string;
  body: string;
  href: string;
  icon?: ReactNode;
  /** Tints the card with the brand colour for visual variety. */
  featured?: boolean;
}

/**
 * Grid of linked feature cards, for module highlights.
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
            className={`flex h-full flex-col gap-3 rounded-2xl border p-6 transition-colors hover:border-primary/60 ${
              item.featured ? 'border-primary/30 bg-primary/10' : 'border-border bg-card'
            }`}
          >
            {item.icon ? <span className="text-primary">{item.icon}</span> : null}
            <span className="text-lg font-semibold">{item.title}</span>
            <span className="text-sm leading-relaxed text-muted-foreground">{item.body}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
