'use client';

import type { ReactNode } from 'react';
import { Chip } from '@heroui/react';
import { cn } from '@/ui/lib/cn';

/** Small pill label shown above section headings (HeroUI Chip). Spark icon is drawn in a light line weight. */
export function PillLabel({ children, tone = 'light', className }: { children: ReactNode; tone?: 'light' | 'dark'; className?: string }) {
  return (
    <Chip
      variant="secondary"
      size="md"
      className={cn('s-pill w-fit', tone === 'dark' && 's-pill-dark', className)}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" aria-hidden>
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
      </svg>
      {children}
    </Chip>
  );
}
