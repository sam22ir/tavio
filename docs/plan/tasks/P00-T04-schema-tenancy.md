# P00-T04 Core tenancy schema
Wave 1. Parallel-safe. Read first: DATA_MODEL.md §0 and §2.2–2.6 (authoritative).
## Files
- `src/core/db/schema/tenancy.ts` (overwrite the stub)
## Implement
Drizzle `pgTable` definitions for `companies`, `memberships`, `roles`, `role_permissions` and `company_modules`.
- Copy every column, type, nullability, default, CHECK constraint, unique constraint and index exactly from DATA_MODEL.md.
- Use `bigint(..., { mode: 'bigint' })` for cents and `uuid().defaultRandom()` for ids.
- Use `timestamp(..., { withTimezone: true }).defaultNow()`.
- Export the inferred types (`Company`, `NewCompany`, …).
- Don't reference auth tables with an FK object import. Use `uuid('user_id')` plus a comment. The integrator adds the FKs.
- Don't generate migrations and don't write RLS here.
## Verification
`pnpm typecheck && pnpm lint`, plus `pnpm db:up && pnpm drizzle-kit generate --name tmp_check` succeeds. Then delete the generated files in `drizzle/` before you finish.
