import type { ShellApp } from '@/ui/shell/load-shell';

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
