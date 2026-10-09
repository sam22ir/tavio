'use client';

import type { ReactNode } from 'react';
import { Chip } from '@heroui/react';

/**
 * Small status or highlight label, built on HeroUI Chip.
 * `accent` is the green soft pill, `neutral` is a white hairline pill.
 */
export function Badge({ tone = 'neutral', children }: { tone?: 'accent' | 'neutral'; children: ReactNode }) {
  return (
    <Chip
      size="sm"
      variant={tone === 'accent' ? 'soft' : 'secondary'}
      color={tone === 'accent' ? 'accent' : 'default'}
      className="border border-[rgba(15,26,23,0.1)] bg-white font-medium text-xs"
    >
      {children}
    </Chip>
  );
}
