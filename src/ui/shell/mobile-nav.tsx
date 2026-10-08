'use client';

import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/ui/primitives/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/primitives/sheet';
import { ShellNav, type ShellNavProps } from '@/ui/shell/shell-nav';

/** Mobile top bar with a menu button that opens the navigation in a Sheet from the start side. */
export function MobileNav(props: Omit<ShellNavProps, 'onNavigate'> & { appName: string }) {
  const t = useTranslations('shell');
  const [open, setOpen] = useState(false);
  const { appName, ...navProps } = props;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-between gap-2">
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t('nav.open')}>
            <Menu aria-hidden="true" />
          </Button>
        </SheetTrigger>
        <span className="font-semibold">{appName}</span>
      </div>
      <SheetContent side="start" className="w-72 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>{t('nav.title')}</SheetTitle>
          <SheetDescription>{t('nav.title')}</SheetDescription>
        </SheetHeader>
        <ShellNav {...navProps} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
