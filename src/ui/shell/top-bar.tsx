'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Bell } from 'lucide-react';
import { MobileNav } from '@/ui/shell/mobile-nav';
import { AccountMenu } from '@/ui/shell/account-menu';
import { CommandSearch } from '@/ui/shell/command-search';
import { currentAppFor } from '@/ui/shell/current-app';
import type { ShellApp, ShellCompany } from '@/ui/shell/load-shell';

export { currentAppFor };

export interface TopBarProps {
  apps: ShellApp[];
  companies: ShellCompany[];
  activeCompanyId: string;
  email: string;
}

const PILL = 'flex h-11 items-center rounded-full bg-surface shadow-[0_1px_2px_rgb(20_23_28/0.04)]';

/**
 * Top bar: the current app's name, its menu as a pill tab bar, then search, notifications and the account menu.
 * Below md the rail is hidden, so a launcher button takes its place.
 */
export function TopBar({ apps, companies, activeCompanyId, email }: TopBarProps) {
  const t = useTranslations('shell');
  const tAll = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const labelOf = (key: string) => (tAll.has(key) ? tAll(key) : key);
  const current = currentAppFor(apps, pathname);
  const dashboardHref = `/${locale}/dashboard`;

  return (
    <header className="flex flex-wrap items-center gap-x-2 gap-y-3 md:gap-x-3 print:hidden">
      <MobileNav apps={apps} className="md:hidden" />
      <p className="me-2 truncate text-lg font-semibold tracking-tight md:text-xl">
        {current ? labelOf(current.app.label) : t('appName')}
      </p>
      {current ? (
        <nav aria-label={t('nav.tabs')} className={`${PILL} order-last max-w-full p-1 md:order-none`}>
          <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
            {current.app.tabs.map((tab) => {
              const active = tab.href === current.activeHref;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={
                    'shrink-0 rounded-full px-4 py-1.5 text-sm whitespace-nowrap transition-colors ' +
                    (active ? 'bg-accent font-medium text-accent-foreground' : 'text-muted hover:bg-default hover:text-foreground')
                  }
                >
                  {labelOf(tab.label)}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
      <div className="ms-auto flex items-center gap-2">
        <div className="w-11 md:w-64">
          <CommandSearch />
        </div>
        <Link
          href={dashboardHref}
          aria-label={t('nav.notifications')}
          className={`${PILL} size-11 justify-center text-muted hover:text-foreground`}
        >
          <Bell aria-hidden="true" className="size-5" />
        </Link>
        <AccountMenu email={email} companies={companies} activeCompanyId={activeCompanyId} />
      </div>
    </header>
  );
}
