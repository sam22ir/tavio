'use client';

import type { ReactNode } from 'react';
import { Chip } from '@heroui/react';
import { cn } from '@/ui/lib/cn';

/** Pill label shown above headings: a white pill with a blue dot (dark variant for navy or blue sections). */
export function PillLabel({ children, tone = 'light', className }: { children: ReactNode; tone?: 'light' | 'dark'; className?: string }) {
  return (
    <Chip variant="secondary" size="md" className={cn('s-pill w-fit', tone === 'dark' && 's-pill-dark', className)}>
      <i className="s-pill-dot" aria-hidden />
      {children}
    </Chip>
  );
}
