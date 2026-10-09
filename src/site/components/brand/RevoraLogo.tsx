import { cn } from '@/ui/lib/cn';
import { LOGO_FULL_PATH, LOGO_FULL_VIEWBOX, MARK_PATH, MARK_VIEWBOX } from './logo-paths';

/**
 * Revora logo, inlined from public/brand/ for crisp rendering.
 * `variant="full"` is the wordmark with the R mark; `variant="mark"` is the R alone.
 * `tone="blue"` uses Revora blue #08409D; `tone="white"` is for blue or navy backgrounds.
 * Give it a width through `className` (the header uses about 120px wide).
 */
export function RevoraLogo({
  variant = 'full',
  tone = 'blue',
  className,
}: {
  variant?: 'full' | 'mark';
  tone?: 'blue' | 'white';
  className?: string;
}) {
  const fill = tone === 'white' ? '#FFFFFF' : '#08409D';
  const isFull = variant === 'full';
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={isFull ? LOGO_FULL_VIEWBOX : MARK_VIEWBOX}
      role="img"
      aria-label="Revora"
      className={cn('block h-auto w-auto', className)}
    >
      <path d={isFull ? LOGO_FULL_PATH : MARK_PATH} fill={fill} />
    </svg>
  );
}
