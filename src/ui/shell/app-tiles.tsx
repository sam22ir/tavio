import Link from 'next/link';
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
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {pillarLabel(pillar)}
            </h2>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {group.map((app) => {
                const Icon = appIcon(app.icon);
                const color = PILLAR_COLOR[pillar];
                return (
                  <li key={app.id}>
                    <Link
                      href={app.href}
                      className="flex h-full flex-col items-center gap-2 rounded-2xl border bg-card p-2 text-center text-card-foreground shadow-sm transition-shadow hover:shadow-md"
                    >
                      <span
                        className="flex size-10 items-center justify-center rounded-2xl"
                        style={{ backgroundColor: `${color}1A`, color }}
                      >
                        <Icon aria-hidden="true" className="size-5" />
                      </span>
                      <span className="text-xs leading-tight font-medium">{labelOf(app.label)}</span>
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
