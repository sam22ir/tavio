# P00-T09 Module system
Wave 1. Parallel-safe. Read first: ARCHITECTURE.md §5.
## Files
- `src/core/modules/define.ts`
- `src/core/modules/graph.ts`
- `src/core/modules/graph.test.ts`
- `scripts/gen-module-registry.ts`
- `src/core/modules/registry.generated.ts` (output; commit it)
## Implement
```ts
// define.ts
export interface MenuItem { label: string; href: string; perm?: string; icon?: string; order?: number }
export interface ModuleManifest {
  id: string;            // snake_case, matches its folder
  name: string;          // i18n key
  version: string;       // semver
  depends: readonly string[];
  permissions: readonly string[]; // each one must start with `${id}.`
  menus: readonly MenuItem[];
  events?: { emits: readonly string[] };
  entities?: readonly unknown[];  // EntityDef arrives in Wave 2
}
export function defineModule<const M extends ModuleManifest>(m: M): M; // validates id and permission prefixes, throws on error

// graph.ts (pure functions)
export function validateGraph(mods: readonly ModuleManifest[]): { ok: true; order: string[] } | { ok: false; missing: [string, string][]; cycles: string[][] };
export function withDependencies(mods, ids: string[]): string[];      // closure of ids plus everything they depend on
export function blockersToDisable(mods, enabled: string[], id: string): string[]; // enabled modules that depend on id
```
The script scans `src/modules/*/manifest.ts` and writes `registry.generated.ts` with static imports plus `export const modules = [...]`. If no modules exist, it writes an empty array. It exits with code 1 when validateGraph fails.
## Tests
Cover a missing dependency, a 3-node cycle, a topological order, the dependency closure, and the disable blockers.
## Verification
`pnpm typecheck && pnpm test src/core/modules && pnpm modules:gen`
