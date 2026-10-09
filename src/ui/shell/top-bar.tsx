'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Bell, LayoutGrid } from 'lucide-react';
import { AccountMenu } from '@/ui/shell/account-menu';
import { CommandSearch } from '@/ui/shell/command-search';
import type { ShellApp, ShellCompany } from '@/ui/shell/load-shell';
import { Button } from '@/ui/primitives/button';

export interface TopBarProps {
  apps: ShellApp[];
  companies: ShellCompany[];
  activeCompanyId: string;
  email: string;
}

/** Finds the app whose menu link is the longest prefix of the current path. */
export function currentAppFor(apps: ShellApp[], pathname: string): { app: ShellApp; activeHref: string } | null {
  let best: { app: ShellApp; activeHref: string } | null = null;
  for (const app of apps) {
    for (const tab of app.tabs) {
      const hit = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
      if (hit && (!best || tab.href.length > best.activeHref.length)) best = { app, activeHref: tab.href };
    }
  }
  return best;
}

/** Sticky top bar: launcher, brand, current app, search, notifications and the account menu, plus the app's tab row. */
export function TopBar({ apps, companies, activeCompanyId, email }: TopBarProps) {
  const t = useTranslations('shell');
  const tAll = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const labelOf = (key: string) => (tAll.has(key) ? tAll(key) : key);
  const current = currentAppFor(apps, pathname);
  const dashboardHref = `/${locale}/dashboard`;

  return (
    <header className="sticky top-0 z-40 border-b bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 md:px-6">
        <Button asChild variant="ghost" size="icon" aria-label={t('nav.launcher')}>
          <Link href={dashboardHref}>
            <LayoutGrid aria-hidden="true" />
          </Link>
        </Button>
        <Link href={dashboardHref} className="flex min-w-0 items-center gap-2 font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/revora-mark-blue.svg" alt="" width={28} height={28} className="size-7 shrink-0" />
          <span className="truncate">{current ? labelOf(current.app.label) : t('appName')}</span>
        </Link>
        <div className="ms-auto flex items-center gap-2">
          <div className="w-40 md:w-64">
            <CommandSearch />
          </div>
          <Button asChild variant="ghost" size="icon" aria-label={t('nav.notifications')}>
            <Link href={dashboardHref}>
              <Bell aria-hidden="true" />
            </Link>
          </Button>
          <AccountMenu email={email} companies={companies} activeCompanyId={activeCompanyId} />
        </div>
      </div>
      {current ? (
        <nav aria-label={t('nav.tabs')} className="border-t">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 md:px-6">
            {current.app.tabs.map((tab) => {
              const active = tab.href === current.activeHref;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={
                    'shrink-0 border-b-2 px-3 py-3 text-sm whitespace-nowrap transition-colors ' +
                    (active
                      ? 'border-primary font-medium text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground')
                  }
                >
                  {labelOf(tab.label)}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
