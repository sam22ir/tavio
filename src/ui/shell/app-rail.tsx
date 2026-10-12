'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { LayoutGrid } from 'lucide-react';
import { appIcon } from '@/ui/shell/app-icons';
import { currentAppFor } from '@/ui/shell/current-app';
import type { ShellApp } from '@/ui/shell/load-shell';

const ITEM =
  'flex size-11 shrink-0 items-center justify-center rounded-2xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/**
 * Slim icon rail: the home launcher plus one icon per enabled app. Desktop only (the launcher in the top bar covers small screens).
 * It sits at the inline start of the frame, so it moves to the right in Arabic without any extra rules.
 */
export function AppRail({ apps }: { apps: ShellApp[] }) {
  const t = useTranslations('shell');
  const tAll = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const labelOf = (key: string) => (tAll.has(key) ? tAll(key) : key);
  const current = currentAppFor(apps, pathname);
  const dashboardHref = `/${locale}/dashboard`;
  const onHome = pathname === dashboardHref;

  return (
    <aside
      aria-label={t('nav.launcher')}
      className="hidden w-[72px] shrink-0 sticky top-4 max-h-[calc(100dvh-2rem)] flex-col items-center gap-2 self-start rounded-3xl bg-surface py-4 shadow-[0_1px_2px_rgb(20_23_28/0.04),0_8px_24px_-12px_rgb(20_23_28/0.1)] md:flex print:hidden"
    >
      <Link href={dashboardHref} aria-label={t('appName')} className="mb-2 flex size-11 items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/revora-mark-blue.svg" alt="" width={30} height={30} className="size-[30px]" />
      </Link>
      <Link
        href={dashboardHref}
        aria-label={t('nav.launcher')}
        title={t('nav.launcher')}
        aria-current={onHome ? 'page' : undefined}
        className={`${ITEM} ${onHome ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-default'}`}
      >
        <LayoutGrid aria-hidden="true" className="size-5" />
      </Link>
      <div aria-hidden="true" className="my-1 h-px w-8 bg-separator" />
      <nav className="flex min-h-0 flex-1 flex-col items-center gap-1.5 overflow-y-auto [scrollbar-width:none]">
        {apps.map((app) => {
          const Icon = appIcon(app.icon);
          const active = current?.app.id === app.id;
          const label = labelOf(app.label);
          return (
            <Link
              key={app.id}
              href={app.href}
              aria-label={label}
              title={label}
              aria-current={active ? 'page' : undefined}
              className={`${ITEM} ${active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-default'}`}
            >
              <Icon aria-hidden="true" className="size-5" />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
