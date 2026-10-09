'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/ui/primitives/button';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/primitives/sheet';
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
 * Mobile navigation in a side Sheet, shown below the xl breakpoint.
 * Uses `side="end"`, so it opens on the reading-start edge in both LTR and RTL.
 */
export function MobileMenu({ links, loginHref, loginLabel, startHref, startLabel, appHref, appLabel, labels }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={labels.open} className="xl:hidden">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="end" className="flex w-full flex-col gap-6 p-6 sm:max-w-sm">
        <SheetHeader className="p-0">
          <SheetTitle>{labels.title}</SheetTitle>
          <SheetDescription className="sr-only">{labels.description}</SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col gap-1">
          {links.map((link) => (
            <SheetClose asChild key={link.href}>
              <Link href={link.href} className="rounded-lg px-3 py-3 text-base hover:bg-muted">
                {link.label}
              </Link>
            </SheetClose>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <LocaleSwitcher />
          {appHref ? (
            <Button asChild size="lg">
              <Link href={appHref}>{appLabel}</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline" size="lg">
                <Link href={loginHref}>{loginLabel}</Link>
              </Button>
              <Button asChild size="lg">
                <Link href={startHref}>{startLabel}</Link>
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
