import type { ModuleManifest } from './define';

export type GraphCheck =
  | { ok: true; order: string[] }
  | { ok: false; missing: [string, string][]; cycles: string[][] };

function indexById(mods: readonly ModuleManifest[]): Map<string, ModuleManifest> {
  const byId = new Map<string, ModuleManifest>();
  for (const m of mods) byId.set(m.id, m);
  return byId;
}

export function validateGraph(mods: readonly ModuleManifest[]): GraphCheck {
  const byId = indexById(mods);
  const ids = [...byId.keys()].sort();

  const missing: [string, string][] = [];
  for (const id of ids) {
    const m = byId.get(id);
    if (!m) continue;
    for (const dep of m.depends) {
      if (!byId.has(dep)) missing.push([id, dep]);
    }
  }

  // Depth-first search with colouring: 1 = on the current path, 2 = done.
  const state = new Map<string, 1 | 2>();
  const cycles: string[][] = [];
  const order: string[] = [];
  const path: string[] = [];

  const visit = (id: string): void => {
    const s = state.get(id);
    if (s === 2) return;
    if (s === 1) {
      const start = path.indexOf(id);
      cycles.push([...path.slice(start), id]);
      return;
    }
    state.set(id, 1);
    path.push(id);
    const m = byId.get(id);
    for (const dep of [...(m?.depends ?? [])].sort()) {
      if (byId.has(dep)) visit(dep);
    }
    path.pop();
    state.set(id, 2);
    order.push(id);
  };

  for (const id of ids) visit(id);

  if (missing.length === 0 && cycles.length === 0) return { ok: true, order };
  return { ok: false, missing, cycles };
}

export function withDependencies(mods: readonly ModuleManifest[], ids: string[]): string[] {
  const byId = indexById(mods);
  const result = new Set<string>();
  const queue = [...ids];
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined || result.has(id)) continue;
    result.add(id);
    const m = byId.get(id);
    if (m) queue.push(...m.depends);
  }
  return [...result].sort();
}

export function blockersToDisable(
  mods: readonly ModuleManifest[],
  enabled: string[],
  id: string,
): string[] {
  const enabledSet = new Set(enabled);
  return mods
    .filter((m) => m.id !== id && enabledSet.has(m.id) && m.depends.includes(id))
    .map((m) => m.id);
}
