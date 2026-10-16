'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronsLeft, ChevronsRight, LayoutGrid } from 'lucide-react';
import { appIcon, PILLAR_COLOR } from '@/ui/shell/app-icons';
import { currentAppFor } from '@/ui/shell/current-app';
import { groupApps } from '@/ui/shell/nav-groups';
import type { ShellApp } from '@/ui/shell/load-shell';

const STORAGE_KEY = 'revora.rail.expanded';
const CHANGE_EVENT = 'revora:rail';
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

function readExpanded(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Icon rail: the home launcher plus one icon per enabled app, grouped by pillar. A toggle expands it to show labels and
 * pillar headings; the choice is remembered per browser. Desktop only (the phone menu in the top bar covers small screens).
 * It sits at the inline start of the frame, so it moves to the right in Arabic without any extra rules.
 */
export function AppRail({ apps }: { apps: ShellApp[] }) {
  const t = useTranslations('shell');
  const tAll = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const expanded = useSyncExternalStore(subscribe, readExpanded, () => false);
  const [animate, setAnimate] = useState(false);
  const isRtl = locale === 'ar';
  const toggle = () => {
    setAnimate(true);
    try {
      localStorage.setItem(STORAGE_KEY, expanded ? '0' : '1');
    } catch {
      /* storage blocked: the toggle does nothing */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  const labelOf = (key: string) => (tAll.has(key) ? tAll(key) : key);
  const current = currentAppFor(apps, pathname);
  const dashboardHref = `/${locale}/dashboard`;
  const onHome = pathname === dashboardHref;
  const groups = groupApps(apps);

  const item = (key: string, href: string, label: string, Icon: ReturnType<typeof appIcon>, active: boolean, color?: string) => (
    <Link
      key={key}
      href={href}
      aria-label={label}
      title={expanded ? undefined : label}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex h-11 items-center gap-3 rounded-2xl transition-colors ${FOCUS} ${
        expanded ? 'w-full px-3' : 'w-11 justify-center'
      } ${active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-default hover:text-foreground'}`}
    >
      {active ? (
        <span aria-hidden="true" className="absolute inset-y-2.5 -start-3 w-1 rounded-full bg-accent" />
      ) : null}
      <Icon aria-hidden="true" className="size-5 shrink-0" style={!active && color ? { color } : undefined} />
      {expanded ? <span className="truncate text-sm font-medium">{label}</span> : null}
    </Link>
  );

  const Toggle = expanded ? (isRtl ? ChevronsRight : ChevronsLeft) : isRtl ? ChevronsLeft : ChevronsRight;

  return (
    <aside
      aria-label={t('nav.launcher')}
      className={`sticky top-4 hidden max-h-[calc(100dvh-2rem)] shrink-0 flex-col items-stretch gap-2 self-start rounded-3xl bg-surface py-4 shadow-[0_1px_2px_rgb(20_23_28/0.04),0_8px_24px_-12px_rgb(20_23_28/0.1)] ${animate ? 'transition-[width] duration-200' : ''} md:flex print:hidden ${
        expanded ? 'w-56 px-3' : 'w-[72px] items-center px-3.5'
      }`}
    >
      <Link href={dashboardHref} aria-label={t('appName')} className={`mb-2 flex h-11 items-center gap-2 ${expanded ? 'px-3' : 'justify-center'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/revora-mark-blue.svg" alt="" width={30} height={30} className="size-[30px] shrink-0" />
        {expanded ? <span className="text-lg font-semibold tracking-tight">{t('appName')}</span> : null}
      </Link>
      {item('home', dashboardHref, t('nav.launcher'), LayoutGrid, onHome)}
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto [scrollbar-width:none]" aria-label={t('nav.title')}>
        {groups.map((g) => (
          <div key={g.pillar ?? 'settings'} className="flex flex-col gap-1">
            {expanded ? (
              <p className="mt-3 mb-1 px-3 text-[11px] font-semibold tracking-wide text-muted uppercase">
                {g.pillar ? t(`pillars.${g.pillar}`) : t('nav.settings')}
              </p>
            ) : (
              <div aria-hidden="true" className={`my-2 h-px w-8 self-center bg-separator`} />
            )}
            {g.apps.map((app) =>
              item(
                app.id,
                app.href,
                labelOf(app.label),
                appIcon(app.icon),
                current?.app.id === app.id,
                g.pillar ? PILLAR_COLOR[g.pillar] : undefined,
              ),
            )}
          </div>
        ))}
      </nav>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        aria-label={expanded ? t('nav.collapse') : t('nav.expand')}
        title={expanded ? undefined : t('nav.expand')}
        className={`mt-1 flex h-10 items-center gap-3 rounded-2xl text-muted transition-colors hover:bg-default hover:text-foreground ${FOCUS} ${
          expanded ? 'w-full px-3' : 'w-11 justify-center'
        }`}
      >
        <Toggle aria-hidden="true" className="size-5 shrink-0" />
        {expanded ? <span className="text-sm">{t('nav.collapse')}</span> : null}
      </button>
    </aside>
  );
}
