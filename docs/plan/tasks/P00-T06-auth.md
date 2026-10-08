# P00-T06 better-auth setup
Wave 1. Parallel-safe. Read first: ARCHITECTURE.md §2 and §8, DATA_MODEL.md §2.1 and §8. Check the current better-auth docs (drizzle adapter, Next.js integration, and how to use uuid ids).
## Files
- `src/core/db/schema/auth.ts` (overwrite the stub; better-auth tables user, session, account, verification, with uuid ids)
- `src/core/auth/server.ts` (new): `export const auth = betterAuth({...})` with the drizzle adapter (provider 'pg', using getDb from `@/core/db/client`; if that file isn't there yet, import it anyway, since it lands in the same wave), emailAndPassword enabled, minPasswordLength 8, uuid id generation
- `src/core/auth/session.ts` (new): `getSession(): Promise<{ userId: string; email: string } | null>` and `requireUser(): Promise<Result<{ userId: string; email: string }>>`, which returns `err('UNAUTHENTICATED', …)`. Both read headers via `next/headers`.
- `src/app/api/auth/[...all]/route.ts` (new): the better-auth Next.js handler
## Rules
- Read the secret from `process.env.BETTER_AUTH_SECRET` only. Never hard-code it, and never log it.
- Don't build UI pages here.
## Verification
`pnpm typecheck && pnpm lint`. If `src/core/db/client.ts` is missing in your worktree, create a temporary one with the same signature from P00-T03, and say so in your report.
