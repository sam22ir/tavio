# P00-T03 DB client and withTenant
Wave 1. Parallel-safe. Read first: ARCHITECTURE.md §3.5 and §6, src/core/ctx.ts, src/core/db/types.ts. Don't edit those files.
## Files
- `src/core/db/client.ts` (new)
- `src/core/db/tenant.ts` (new)
- `src/core/db/tenant.int.test.ts` (new)
## Implement
```ts
// client.ts
export function getDb(): Db;
// Lazily creates one pg Pool from process.env.DATABASE_URL (throws if missing) and returns drizzle(pool).
// Cached at module level.

// tenant.ts
export interface TenantArgs { userId: string; companyId: string; perms: ReadonlySet<string>; locale: Locale }
export async function withTenant<T>(args: TenantArgs, fn: (ctx: Ctx) => Promise<T>, db?: Db): Promise<T>;
// Runs in db.transaction(tx => ...). The first statement is
// sql`select set_config('app.company_id', ${companyId}, true), set_config('app.user_id', ${userId}, true)`.
// Then it calls fn with ctx = { ...args, tx }.
// Validate that companyId and userId are UUIDs; throw an Error if not.
// If fn throws, the transaction rolls back and the error is rethrown.
```
## Integration test (needs `pnpm db:up`)
- Inside withTenant, `current_setting('app.company_id', true)` equals the companyId.
- After the transaction, a new connection gets '' or null.
- A throw inside fn rolls back an insert into a temp table that the test creates.
## Verification
`pnpm typecheck && pnpm db:up && pnpm test:int src/core/db`
