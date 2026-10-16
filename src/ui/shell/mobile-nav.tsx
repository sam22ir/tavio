'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { LayoutGrid, Menu } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/ui/primitives/sheet';
import { appIcon, PILLAR_COLOR } from '@/ui/shell/app-icons';
import { currentAppFor } from '@/ui/shell/current-app';
import { groupApps } from '@/ui/shell/nav-groups';
import type { ShellApp } from '@/ui/shell/load-shell';

/** Phone menu: a button in the top bar opening a drawer with every app, grouped by pillar, with labels. Below md only. */
export function MobileNav({ apps, className = '' }: { apps: ShellApp[]; className?: string }) {
  const t = useTranslations('shell');
  const tAll = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const labelOf = (key: string) => (tAll.has(key) ? tAll(key) : key);
  const current = currentAppFor(apps, pathname);
  const dashboardHref = `/${locale}/dashboard`;

  const row = (key: string, href: string, label: string, Icon: ReturnType<typeof appIcon>, active: boolean, color?: string) => (
    <SheetClose asChild key={key}>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-medium ${active ? 'bg-accent-soft text-accent' : 'hover:bg-default'}`}
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full"
          style={color && !active ? { backgroundColor: `${color}1A`, color } : undefined}
        >
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <span className="truncate">{label}</span>
      </Link>
    </SheetClose>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={t('nav.open')}
        className={`flex size-11 items-center justify-center rounded-full bg-surface text-muted shadow-[0_1px_2px_rgb(20_23_28/0.04)] hover:text-foreground ${className}`}
      >
        <Menu aria-hidden="true" className="size-5" />
      </SheetTrigger>
      <SheetContent
        side="start"
        showCloseButton
        className="w-[85%] max-w-xs gap-0 bg-surface p-0 rtl:data-[state=open]:slide-in-from-right rtl:data-[state=closed]:slide-out-to-right"
      >
        <SheetHeader className="pe-14">
          <SheetTitle className="text-lg">{t('appName')}</SheetTitle>
          <SheetDescription className="sr-only">{t('nav.title')}</SheetDescription>
        </SheetHeader>
        <nav aria-label={t('nav.title')} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-6">
          {row('home', dashboardHref, t('nav.launcher'), LayoutGrid, pathname === dashboardHref)}
          {groupApps(apps).map((g) => (
            <div key={g.pillar ?? 'settings'} className="flex flex-col gap-1">
              <p className="mt-4 mb-1 px-3 text-[11px] font-semibold tracking-wide text-muted uppercase">
                {g.pillar ? t(`pillars.${g.pillar}`) : t('nav.settings')}
              </p>
              {g.apps.map((app) =>
                row(app.id, app.href, labelOf(app.label), appIcon(app.icon), current?.app.id === app.id, g.pillar ? PILLAR_COLOR[g.pillar] : undefined),
              )}
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
