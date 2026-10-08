# P00-T01 Scaffold and shared contracts
**Wave 0. Must finish before all other tasks.**

## Goal
Create the empty Next.js app with all tooling and Wave 1 dependencies installed, the frozen contract files, and stub files that later tasks overwrite.

## Steps
1. Run this in `/home/saadi/tavio`. The `docs/` folder already exists, so keep it.
   ```
   pnpm create next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
   ```
2. Use the latest stable versions. Install:
   - **deps:** drizzle-orm, pg, better-auth, next-intl, zod, clsx, tailwind-merge
   - **devDeps:** drizzle-kit, dotenv, @types/pg, vitest, @vitejs/plugin-react, jsdom, @testing-library/react, @testing-library/jest-dom, tsx, @opennextjs/cloudflare, wrangler
3. In `tsconfig.json`, set `"strict": true` and `"noUncheckedIndexedAccess": true`.
4. Create `vitest.config.ts`:
   - Unit tests are `src/**/*.test.ts(x)`, excluding `*.int.test.ts`.
   - Use jsdom for `.tsx` tests.
   - Set up the `@/` alias.
5. Create `vitest.int.config.ts` with `include: ['src/**/*.int.test.ts']` and node environment.
6. Create `src/core/env/load-dev-env.ts`. It exports `loadDevEnv()`, which loads (with dotenv, without overriding existing vars) the file at `process.env.TAVIO_ENV_FILE ?? ~/.config/tavio/test.env`. It does nothing if that file is missing. Call it at the top of `vitest.int.config.ts` and `drizzle.config.ts`. This file holds the dev Supabase credentials. **Never print, cat, copy or log it.**
7. Create `.env.example` with placeholder values only, no real secrets:
   ```
   DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres
   BETTER_AUTH_SECRET=change-me
   BETTER_AUTH_URL=http://localhost:3000
   ```
   Check that `.gitignore` covers `.env*` but not `.env.example`.
8. Create `drizzle.config.ts` with `schema: ['./src/core/db/schema/index.ts', './src/modules/*/schema.ts']`, `out: './drizzle'`, `dialect: 'postgresql'`, url from `DATABASE_URL`.
9. Add these `package.json` scripts:
   - `dev`, `build`, `start`, `lint`
   - `typecheck`: `tsc --noEmit`
   - `test`: `vitest run`
   - `test:int`: `vitest run -c vitest.int.config.ts`
   - `db:generate`: `drizzle-kit generate`
   - `db:migrate`: `drizzle-kit migrate`
   - `modules:gen`: `tsx scripts/gen-module-registry.ts`
10. Create the contract files with **exactly** this content:

`src/core/result.ts`
```ts
export type ErrorCode =
  | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION'
  | 'CONFLICT' | 'STATE' | 'MODULE_DISABLED' | 'INTERNAL';
export interface AppError { code: ErrorCode; message: string; details?: Record<string, unknown> }
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = (code: ErrorCode, message: string, details?: Record<string, unknown>): Result<never> =>
  ({ ok: false, error: { code, message, details } });
```
`src/core/db/types.ts`
```ts
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
export type Db = NodePgDatabase;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
```
`src/core/ctx.ts`
```ts
import type { Tx } from './db/types';
export type Locale = 'fr' | 'ar' | 'en';
export interface Ctx {
  readonly userId: string;
  readonly companyId: string;
  readonly perms: ReadonlySet<string>;
  readonly locale: Locale;
  readonly tx: Tx;
}
```
`src/core/db/schema/index.ts`
```ts
export * from './tenancy';
export * from './infra';
export * from './auth';
```
11. Create these stub files, each containing only `export {};`. Later tasks overwrite them.
    - `src/core/db/schema/tenancy.ts`
    - `src/core/db/schema/infra.ts`
    - `src/core/db/schema/auth.ts`
12. Create the empty folders (with `.gitkeep`): `src/modules`, `src/ui`, `scripts`, `drizzle`.
13. Add one sanity test, `src/core/result.test.ts`, checking that `ok(1)` and `err('NOT_FOUND','x')` have the expected shapes.
14. Leave `src/app/layout.tsx`, `src/app/page.tsx` and `src/app/globals.css` as generated. P00-T07 owns the layout and page, and P00-T08 owns globals.css.

## Verification
`pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass.
