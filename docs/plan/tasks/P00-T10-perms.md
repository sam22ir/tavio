# P00-T10 Permission checks
Wave 1. Parallel-safe. Read first: ARCHITECTURE.md §8, src/core/ctx.ts, src/core/result.ts.
## Files
- `src/core/perms/index.ts`
- `src/core/perms/perms.test.ts`
## Implement
```ts
export function can(perms: ReadonlySet<string>, perm: string): boolean;
// true if the exact string is present, or "*", or a prefix wildcard "crm.*" / "crm.lead.*" matches.
export function requirePerm(ctx: Pick<Ctx, 'perms'>, perm: string): Result<void>;
// returns ok(undefined) or err('FORBIDDEN', `Missing permission ${perm}`, { perm })
export const OWNER_PERMS: ReadonlySet<string>; // new Set(['*'])
```
## Tests
Cover an exact match, "*", "crm.*", "crm.lead.*", a non-match like "crmx.lead.read" against "crm.*", and an empty set.
## Verification
`pnpm typecheck && pnpm test src/core/perms`
