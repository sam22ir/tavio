import { APP_PILLARS, type AppPillar } from '@/core/modules/define';
import type { ShellApp } from '@/ui/shell/load-shell';

export interface NavGroup {
  /** Null for the configuration group, which has its own heading. */
  pillar: AppPillar | null;
  apps: ShellApp[];
}

/** Configuration apps live under /settings; the rail and the phone menu show them last, in their own group. */
export const isSettingsApp = (a: ShellApp) => a.href.includes('/settings/');

/** Apps grouped by pillar (in pillar order), then one trailing group of configuration apps. Empty groups are dropped. */
export function groupApps(apps: ShellApp[]): NavGroup[] {
  const main = apps.filter((a) => !isSettingsApp(a));
  const groups: NavGroup[] = APP_PILLARS.map((pillar) => ({ pillar, apps: main.filter((a) => a.pillar === pillar) }));
  groups.push({ pillar: null, apps: apps.filter(isSettingsApp) });
  return groups.filter((g) => g.apps.length > 0);
}
