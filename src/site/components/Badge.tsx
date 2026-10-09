import type { ReactNode } from 'react';
import { Badge as UiBadge } from '@/ui/primitives/badge';

/**
 * Small status or highlight label.
 * `accent` uses the brand colour, `neutral` is an outline badge.
 */
export function Badge({ tone = 'neutral', children }: { tone?: 'accent' | 'neutral'; children: ReactNode }) {
  return <UiBadge variant={tone === 'accent' ? 'default' : 'outline'}>{children}</UiBadge>;
}
