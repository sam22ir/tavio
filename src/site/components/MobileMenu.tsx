'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/primitives/sheet';
import { CtaLink } from './CtaLink';
import { LocaleSwitcher } from './LocaleSwitcher';

export interface MobileMenuProps {
  /** Locale-prefixed links with their labels. */
  links: { label: string; href: string }[];
  /** Log-in and CTA targets; when `appHref` is set, the CTA becomes "Open app". */
  loginHref: string;
  loginLabel: string;
  startHref: string;
  startLabel: string;
  appHref?: string;
  appLabel?: string;
  labels: { open: string; title: string; description: string };
}

/**
 * Mobile navigation in a Sheet, shown below the xl breakpoint.
 * Uses `side="end"`, so it opens on the reading-start edge in both LTR and RTL.
 */
export function MobileMenu({ links, loginHref, loginLabel, startHref, startLabel, appHref, appLabel, labels }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={labels.open}
          className="s-navlink flex size-10 items-center justify-center rounded-full bg-[var(--s-accent-soft)] text-[color:var(--s-ink)] xl:hidden"
        >
          <Menu className="size-5" strokeWidth={1.25} />
        </button>
      </SheetTrigger>
      <SheetContent side="end" className="flex w-full flex-col gap-8 bg-[var(--background)] p-6 sm:max-w-sm">
        <SheetHeader className="p-0">
          <SheetTitle className="font-bold tracking-tight">{labels.title}</SheetTitle>
          <SheetDescription className="sr-only">{labels.description}</SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col gap-1">
          {links.map((link) => (
            <SheetClose asChild key={link.href}>
              <Link href={link.href} className="rounded-2xl px-4 py-3 text-lg font-medium hover:bg-white">
                {link.label}
              </Link>
            </SheetClose>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <LocaleSwitcher />
          {appHref ? (
            <CtaLink href={appHref} label={appLabel ?? ''} className="justify-between" />
          ) : (
            <>
              <CtaLink href={loginHref} label={loginLabel} variant="light" arrow={false} className="justify-center" />
              <CtaLink href={startHref} label={startLabel} className="justify-between" />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
