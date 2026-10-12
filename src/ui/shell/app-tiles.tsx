import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { appIcon, PILLAR_COLOR } from '@/ui/shell/app-icons';
import type { ShellApp } from '@/ui/shell/load-shell';
import { APP_PILLARS, type AppPillar } from '@/core/modules/define';

/** Launcher grid: apps grouped under their pillar heading. Server-rendered. */
export function AppTiles({
  apps,
  pillarLabel,
  labelOf,
}: {
  apps: ShellApp[];
  pillarLabel: (p: AppPillar) => string;
  labelOf: (key: string) => string;
}) {
  return (
    <div className="flex flex-col gap-8">
      {APP_PILLARS.map((pillar) => {
        const group = apps.filter((a) => a.pillar === pillar);
        if (group.length === 0) return null;
        return (
          <section key={pillar} className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
              {pillarLabel(pillar)}
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {group.map((app) => {
                const Icon = appIcon(app.icon);
                const color = PILLAR_COLOR[pillar];
                return (
                  <li key={app.id}>
                    <Link
                      href={app.href}
                      className="app-panel flex h-full flex-col gap-3 rounded-3xl p-4 text-start transition-shadow hover:shadow-md"
                    >
                      <span className="flex items-start justify-between">
                        <span
                          className="flex size-10 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${color}1A`, color }}
                        >
                          <Icon aria-hidden="true" className="size-5" />
                        </span>
                        <ArrowUpRight aria-hidden="true" className="size-4 text-muted rtl:-scale-x-100" />
                      </span>
                      <span className="text-sm leading-tight font-medium">{labelOf(app.label)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
