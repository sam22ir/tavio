import type { LucideIcon } from 'lucide-react';
import { cn } from '@/ui/lib/cn';

export type Tint = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'violet';

/** Pastel tint + deep tone of one hue (tokens in globals.css). Used for icon tiles, chips and feed rows. */
export const TINT: Record<Tint, string> = {
  success: 'bg-tint-success text-tint-success-fg',
  warning: 'bg-tint-warning text-tint-warning-fg',
  danger: 'bg-tint-danger text-tint-danger-fg',
  info: 'bg-tint-info text-tint-info-fg',
  neutral: 'bg-tint-neutral text-tint-neutral-fg',
  violet: 'bg-tint-violet text-tint-violet-fg',
};

export function TintIcon({ icon: Icon, tint = 'info', className }: { icon: LucideIcon; tint?: Tint; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', TINT[tint], className)}>
      <Icon className="size-5" />
    </span>
  );
}

export function StatusChip({ tint = 'neutral', children, className }: { tint?: Tint; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', TINT[tint], className)}>
      {children}
    </span>
  );
}
