'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Menu } from 'lucide-react';
import { Button, Drawer } from '@heroui/react';
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
 * Mobile navigation in a HeroUI Drawer, shown below the xl breakpoint.
 * Opens from the reading-start edge: right in LTR, left in Arabic.
 */
export function MobileMenu({ links, loginHref, loginLabel, startHref, startLabel, appHref, appLabel, labels }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  // Drawer placement is physical, so Arabic (RTL) opens from the left, the reading-start edge.
  const placement = useLocale() === 'ar' ? 'left' : 'right';
  return (
    <Drawer isOpen={open} onOpenChange={setOpen}>
      <Button variant="ghost" isIconOnly aria-label={labels.open} className="rounded-full bg-[var(--s-accent-soft)] xl:hidden" onPress={() => setOpen(true)}>
        <Menu className="size-5" strokeWidth={1.25} />
      </Button>
      <Drawer.Backdrop>
        <Drawer.Content placement={placement}>
          <Drawer.Dialog className="w-full bg-[var(--background)] sm:max-w-sm">
            <Drawer.Header>
              <Drawer.Heading className="font-bold tracking-tight">{labels.title}</Drawer.Heading>
              <span className="sr-only">{labels.description}</span>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-8">
              <nav className="flex flex-col gap-1">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="rounded-2xl px-4 py-3 text-lg font-medium hover:bg-white"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-3">
                <LocaleSwitcher className="self-start" />
                {appHref ? (
                  <CtaLink href={appHref} label={appLabel ?? ''} className="justify-between" />
                ) : (
                  <>
                    <CtaLink href={loginHref} label={loginLabel} variant="light" arrow={false} className="justify-center" />
                    <CtaLink href={startHref} label={startLabel} className="justify-between" />
                  </>
                )}
              </div>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
