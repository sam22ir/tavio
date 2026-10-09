import type { ReactNode } from 'react';

/**
 * Small status or highlight label.
 * `accent` is the green soft pill, `neutral` is a white hairline pill.
 */
export function Badge({ tone = 'neutral', children }: { tone?: 'accent' | 'neutral'; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
        tone === 'accent' ? 'bg-[var(--s-accent-soft)] text-[color:var(--s-accent)]' : 'border border-[rgba(15,26,23,0.1)] bg-white'
      }`}
    >
      {children}
    </span>
  );
}
