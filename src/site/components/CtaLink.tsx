import Link from 'next/link';
import { cn } from '@/ui/lib/cn';

const ARROW = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="s-flip-rtl" aria-hidden>
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

/** Pill CTA with a trailing arrow in its own circle. Dark is primary, light is secondary, accent is for green bands. */
export function CtaLink({
  href,
  label,
  variant = 'dark',
  arrow = true,
  className,
}: {
  href: string;
  label: string;
  variant?: 'dark' | 'light' | 'accent';
  arrow?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={cn('s-btn group', `s-btn-${variant}`, arrow && 's-btn-arrow', className)}>
      <span>{label}</span>
      {arrow ? <span className="s-btn-icon">{ARROW}</span> : null}
    </Link>
  );
}
