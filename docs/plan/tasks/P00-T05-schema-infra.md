# P00-T05 Core infrastructure schema
Wave 1. Parallel-safe. Read first: DATA_MODEL.md §0 and §2.7–2.10 (authoritative).
## Files
- `src/core/db/schema/infra.ts` (overwrite the stub)
## Implement
Drizzle tables `audit_log`, `sequences`, `outbox` and `files`.
- Copy every column, type, default, CHECK, unique constraint and index exactly from DATA_MODEL.md.
- Export the inferred types.
- No migrations, no RLS, no FK imports from other schema files (use a comment instead).
## Verification
Same as P00-T04: typecheck, lint, then `drizzle-kit generate --name tmp_check` succeeds. Delete the generated files afterwards.
