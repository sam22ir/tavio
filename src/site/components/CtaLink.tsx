import Link from 'next/link';
import { buttonVariants } from '@heroui/styles';
import { cn } from '@/ui/lib/cn';

const ARROW = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="s-flip-rtl" aria-hidden>
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

/**
 * Pill CTA with a trailing arrow in its own circle, styled with HeroUI button variants.
 * Dark ink is the primary look, light is the secondary (white pill), accent is for green bands.
 * It is a link, so it stays a real anchor for navigation and SEO.
 */
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
  const heroVariant = variant === 'light' ? 'secondary' : 'primary';
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: heroVariant, size: 'lg' }),
        'group s-btn rounded-full',
        `s-btn-${variant}`,
        arrow && 's-btn-arrow',
        className,
      )}
    >
      <span>{label}</span>
      {arrow ? <span className="s-btn-icon">{ARROW}</span> : null}
    </Link>
  );
}
