# Wave 2: finish P0 foundations

Every task:
- Read `docs/plan/ARCHITECTURE.md`, `docs/plan/CONVENTIONS.md`, `docs/plan/DATA_MODEL.md` §2 and `AGENTS.md` (Next 16 differs from what you know; see `node_modules/next/dist/docs/`).
- Edit **only** the files your task owns. Stub files under `src/core/**` carry frozen signatures: keep them exactly and replace only the bodies.
- **Verification** for every task: `pnpm typecheck && pnpm lint && pnpm test`, plus `pnpm test:int` when the task has `*.int.test.ts`. Integration tests use the dev Supabase DB through `loadDevEnv()`. Never print its credentials.
- Integration tests must create their own rows with random uuids and delete them afterwards. The DB is shared.
- i18n: use `useTranslations` / `getTranslations`. Add keys only to the namespace files your task owns (`messages/{fr,ar,en}/<ns>.json`), in all 3 languages. Arabic must be real Arabic.
- UI: use `@/ui/primitives/*`, logical CSS classes only, mobile-first.

---
## W2-A RLS, app role, user FKs
**Owns:** `drizzle/0001_core_rls.sql` (+ the journal/meta entries), `src/core/db/tenant.ts`, `src/core/db/rls.int.test.ts`
- Create the file with `pnpm drizzle-kit generate --custom --name core_rls`, then write SQL that is safe to re-run where possible:
  1. `create role tavio_app nologin` (guarded with `do $$ … if not exists`), then `grant tavio_app to current_user`, `grant usage on schema public to tavio_app`, `grant select, insert, update, delete on all tables in schema public to tavio_app`, `grant usage, select on all sequences in schema public to tavio_app`, and `alter default privileges in schema public grant select, insert, update, delete on tables to tavio_app`.
  2. `revoke all on users, sessions, accounts, verifications from tavio_app`.
  3. Enable RLS (`enable` + `force`) on the tenant tables `memberships, roles, role_permissions, company_modules, audit_log, sequences, outbox, files`. Each gets one policy `tenant_isolation` for all commands, `using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)` with the same `with check`.
  4. `companies`: RLS policy `id = nullif(current_setting('app.company_id', true), '')::uuid`.
  5. Foreign keys `memberships.user_id → users.id on delete cascade`, plus every `created_by`/`user_id`-style column in core tables → `users.id`. Check DATA_MODEL for which ones are nullable.
  6. A function `tavio_forbid_posted_change()` (trigger function) that raises `'POSTED_IMMUTABLE'` when `OLD.state = 'posted'` on UPDATE or DELETE, except when the only change is `state` moving from `'posted'` to `'cancelled'`. P4+ tables attach it.
- In `withTenant`, right after the `set_config` call, run `set local role tavio_app`.
- Integration test: create 2 companies as the owner connection. Insert a role in each. Inside withTenant(A), select roles and see only A's role. An insert with B's company_id fails. With no tenant set, 0 rows come back.
- Run `pnpm db:migrate` to apply it to the dev DB, then run the tests.

## W2-B Sequences service
**Owns:** `src/core/sequences/index.ts` (replace the stub body), `src/core/sequences/sequences.int.test.ts`
- `nextNumber(ctx, code, defaults)`:
  - `insert … on conflict (company_id, code) do nothing` using the defaults (prefix '', padding 5).
  - Then one atomic `update sequences set next_number = next_number + 1 where company_id = ctx.companyId and code = $code returning next_number - 1 as n, prefix, padding`.
  - Format as prefix with `{YYYY}` replaced by the current year (Africa/Algiers), followed by n left-padded with zeros.
  - Use `ctx.tx` only.
- Tests: sequential calls give 00001, 00002. A rolled-back transaction doesn't consume a number. The `{YYYY}` token is replaced.

## W2-C Audit writer
**Owns:** `src/core/audit/index.ts`, `src/core/audit/audit.int.test.ts`
- `audit(ctx, entry)` inserts into `audit_log`, using ctx.companyId and ctx.userId and storing before/after as jsonb. bigint values are serialized as strings.
- Test: a row is written inside the tx, and it disappears on rollback.

## W2-D Event bus and outbox
**Owns:** `src/core/events/index.ts`, `src/core/events/events.test.ts`, `src/core/events/outbox.int.test.ts`
- `on` keeps handlers in a module-level Map. `emit` awaits every handler for `event.name` sequentially with the same ctx, then inserts an `outbox` row (status pending).
- `drainOutbox` runs in its own transaction: `select … where status='pending' order by created_at limit $n for update skip locked`. For each row it calls handle. On success it marks the row done (processed_at); on error it increments attempts and stores last_error, and after 5 attempts sets status failed. Use the DATA_MODEL column names.
- Tests: handler order, a handler error propagates, and drain marks rows done or failed.

## W2-E Tenancy service and active company
**Owns:** `src/core/tenancy/service.ts`, `src/core/tenancy/active.ts`, `src/core/tenancy/default-roles.ts`, `src/core/tenancy/tenancy.int.test.ts`
- These functions run **as the owner connection** (`getDb()`, no withTenant) and always filter by userId.
- `default-roles.ts` exports `DEFAULT_ROLES`: owner → ['*'], admin → ['*'], manager → ['contacts.*','products.*','credit.*','crm.*','settings.read'], staff → ['contacts.partner.read','contacts.partner.write','products.product.read','credit.contract.read','credit.payment.write','crm.lead.*'].
- `createCompany`: in one transaction, insert the company, seed the 4 roles with role_permissions, create an owner membership (status active), and enable the modules core, contacts, products, l10n_dz, chatter, credit, crm in company_modules. It returns VALIDATION if legalName is shorter than 2 characters.
- `listMyCompanies`: the user's active memberships joined with companies and roles.
- `loadTenantArgs`: FORBIDDEN unless the user has an active membership. perms = the role's permission set.
- `enabledModules`: the enabled module ids.
- `active.ts`: reads and writes the httpOnly cookie `tavio_company` (sameSite lax, secure in production, 1 year) via `next/headers` cookies().
- Integration test for create, list, loadTenantArgs and the forbidden case. Create a user row directly in `users` for the test and delete everything afterwards.

## W2-F defineAction
**Owns:** `src/core/actions/define-action.ts`, `src/core/actions/define-action.test.ts`
- Implement the stub's contract:
  1. `requireUser()`, else UNAUTHENTICATED.
  2. `getActiveCompanyId()`, else `err('FORBIDDEN','NO_COMPANY')`.
  3. Locale from `getLocale()` (next-intl/server).
  4. `loadTenantArgs`.
  5. If `module` is set and it isn't in `enabledModules`, return MODULE_DISABLED.
  6. `withTenant`.
  7. `requirePerm`.
  8. `schema.safeParse`: VALIDATION with `details.issues`.
  9. Call fn.
  10. Catch everything: a thrown error whose message is 'POSTED_IMMUTABLE' becomes that code, anything else becomes INTERNAL. Log with `console.error` but never include input values.
- `toFormAction`: `Object.fromEntries(formData)` → action. On VALIDATION, build fieldErrors from the issues. On ok, return `{ ok: true, redirectTo }`.
- Unit-test with `vi.mock` of the session, active, tenancy and tenant modules.

## W2-G Auth pages and onboarding
**Owns:** `src/core/auth/client.ts`, `src/app/[locale]/(auth)/layout.tsx`, `src/app/[locale]/(auth)/login/page.tsx`, `src/app/[locale]/(auth)/signup/page.tsx`, `src/app/[locale]/(auth)/auth-form.tsx`, `src/app/[locale]/onboarding/page.tsx`, `src/app/[locale]/onboarding/actions.ts`, and `messages/*/auth.json`
- `client.ts`: `createAuthClient()` from `better-auth/react`.
- Login and signup are client forms (email, password, plus name on signup) using authClient.signIn.email / signUp.email. On success they go to `/{locale}/dashboard`, and they show translated errors.
- The layout is a centered card with the Tavio name and a language switcher (simple links to /fr, /ar, /en for the same path).
- Onboarding page: requires a session (else redirect to login) and shows a form with the company legal name, phone, address and wilaya (a text code for now). Its server action calls `createCompany` then `setActiveCompanyId`, and redirects to the dashboard.
- Test: one render test of auth-form with the client mocked.

## W2-H App shell
**Owns:** `src/app/[locale]/(app)/layout.tsx`, `src/app/[locale]/(app)/dashboard/page.tsx`, `src/app/[locale]/(app)/settings/page.tsx`, `src/app/[locale]/page.tsx`, `src/ui/shell/*` (sidebar, topbar, company-switcher, locale-switcher, user-menu, mobile-nav), `src/ui/shell/actions.ts`, and `messages/*/shell.json` + `messages/*/settings.json`
- **Layout:** without a session, redirect to `/{locale}/login`. If the user has no companies, redirect to `/onboarding`. If the active cookie is missing or invalid, use the first company.
  - Menus come from `modules` in `@/core/modules/registry.generated`, filtered by `enabledModules` and `can(perms, menu.perm)`, sorted by order.
  - Always add Dashboard and Settings.
- **Desktop:** a sidebar on the start side. **Mobile (<768px):** a top bar with a menu button that opens a Sheet from the start side.
- **Company switcher:** a dropdown that calls a server action `switchCompany(id)`, which checks membership, sets the cookie and refreshes.
- **Locale switcher:** fr / ar / en.
- **User menu:** shows the email and a logout button (authClient.signOut, then go to login).
- **Dashboard:** a greeting and an empty state ("modules will appear here").
- **Settings:** company info read-only for now.
- **Root `[locale]/page.tsx`:** redirect to dashboard if there's a session, else to login.

## W2-I DataList, search and paging
**Owns:** `src/core/entities/list-query.ts`, `src/core/entities/list-query.test.ts`, `src/ui/views/data-list.tsx`, `src/ui/views/search-bar.tsx`, `src/ui/views/pagination.tsx`, `src/ui/views/format.tsx`, and `messages/*/views.json`
- `parseListQuery(sp: Record<string, string | string[] | undefined>, entity: EntityDef): ListQuery`. Unknown sort fields are dropped, pageSize is clamped to 1..100 (default 25), and `f_<field>=value` becomes filters, only for fields with `filter: true`. Also `toSearchParams(q: ListQuery): URLSearchParams`.
- `DataList` is a server component with props `{ entity, result: ListResult, query, basePath, rowHref?: (r: Row) => string, actions?: ReactNode }`.
  - **Desktop:** a table with the `list: true` columns and sortable headers (links).
  - **Mobile:** stacked cards (label field as the title, plus 2 more fields).
  - The empty state is translated.
- `format.tsx`: `formatCell(field, value, locale)`. Money uses `formatDzd` (value is a bigint or a string of cents), dates use Intl, booleans show ✓/–, and selects use the translated option label.
- `SearchBar` is a client component. It updates `q` in the URL with a 300ms debounce, and has filter selects for `filter: true` select fields.
- `Pagination` uses links.
- `views.json` must also contain the keys used by W2-J and W2-K: `views.save`, `views.cancel`, `views.saving`, `views.required`, `views.saved`, `views.error`, `views.empty`, `views.search`, `views.filters`, `views.prev`, `views.next`, `views.page`, `views.kanban.move`, `views.kanban.empty_column`, `views.yes`, `views.no`.

## W2-J RecordForm
**Owns:** `src/ui/views/record-form.tsx`, `src/ui/views/fields.tsx`, `src/ui/views/record-form.test.tsx`
- `RecordForm` is a client component with props `{ entity, values?: Partial<Row>, action: (prev: FormState, fd: FormData) => Promise<FormState>, submitLabel?: string, hidden?: Record<string, string>, relationOptions?: Record<string, { value: string; label: string }[]> }`.
- It uses `useActionState`, renders one widget per field with `form !== false && !readonly`, shows fieldErrors under the fields, and disables submit while pending.
- It calls `router.push(state.redirectTo)` when set.
- Money fields take text input in DZD; the server parses it with parseDzd. Relation fields render a select from relationOptions.
- Labels go through `useTranslations()` with the field.label key.
- Test: it renders the fields, and it shows a field error when the action returns one.

## W2-K Kanban
**Owns:** `src/ui/views/kanban.tsx`, `src/ui/views/kanban.test.tsx`
- `Kanban` is a client component with props `{ entity, columns: { id: string; label: string }[], rows: Row[], onMove: (rowId: string, toColumn: string) => Promise<Result<unknown>>, rowHref: (r: Row) => string }`.
- **Desktop:** horizontal columns with HTML5 drag and drop plus a "move" dropdown on each card (for accessibility). **Mobile:** stage tabs, a vertical card list and the move dropdown.
- The move is optimistic (useOptimistic) and rolls back on error, with a toast (sonner).
- Test: rendering puts cards in the correct columns, and a failed move restores the card.

## W2-L Storage adapter and files service
**Owns:** `src/core/adapters/storage/types.ts`, `src/core/adapters/storage/s3.ts`, `src/core/adapters/storage/index.ts`, `src/core/adapters/storage/s3.test.ts`, `src/core/files/service.ts`, `src/core/files/files.int.test.ts`. You may add the dependency `aws4fetch`.
- Interface `Storage { put(key, body: Uint8Array, contentType): Promise<void>; signedGetUrl(key, expiresSec = 300): Promise<string>; delete(key): Promise<void> }`.
- `S3Storage` uses aws4fetch and works with Cloudflare R2 and MinIO. Its env: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` (default 'auto').
- `getStorage()` returns S3Storage when the env is set, else a `MemoryStorage` (dev and tests).
- Files service:
  - `uploadFile(ctx, { entity, recordId, fileName, contentType, bytes, kind })`: the key is `${companyId}/${entity}/${recordId}/${uuid}-${safeName}`. It puts the object, inserts the files row, and returns the row.
  - `fileUrl(ctx, fileId)`: the row is checked under RLS through ctx.tx, and it returns a signed URL.
  - Max 10 MB. Allowed types are image/jpeg, image/png, image/webp and application/pdf, else VALIDATION. Return a Result.
- Tests mock fetch for S3, and the integration test uses MemoryStorage.

## W2-M PDF adapter
**Owns:** `src/core/adapters/pdf/types.ts`, `src/core/adapters/pdf/browser-rendering.ts`, `src/core/adapters/pdf/gotenberg.ts`, `src/core/adapters/pdf/index.ts`, `src/core/adapters/pdf/pdf.test.ts`
- Interface `PdfRenderer { fromHtml(html: string, opts?: { format?: 'A4' | 'A5'; landscape?: boolean }): Promise<Uint8Array> }`.
- **Browser Rendering:** `POST https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/browser-rendering/pdf` with a Bearer `CF_API_TOKEN` and body `{ html, pdfOptions: { format, landscape, printBackground: true } }`. Check the current Cloudflare docs.
- **Gotenberg:** a multipart POST to `${GOTENBERG_URL}/forms/chromium/convert/html` with index.html.
- `getPdfRenderer()` chooses by `PDF_PROVIDER` ('browser-rendering' | 'gotenberg'). If unset, it returns a renderer that throws `PDF_NOT_CONFIGURED`.
- Tests mock fetch.

## W2-N Workers DB connection and outbox cron route
**Owns:** `src/core/db/client.ts`, `src/core/db/client.test.ts`, `src/app/api/cron/outbox/route.ts`
- `getDb()`: when running on Cloudflare, use `getCloudflareContext()` from `@opennextjs/cloudflare` inside try/catch. If it works and `env.HYPERDRIVE` exists, create a pg Pool `{ connectionString: env.HYPERDRIVE.connectionString, max: 5 }` per request, cached in a WeakMap keyed by `ctx` (the ExecutionContext). Otherwise keep the existing Node singleton behavior. Keep the exported signature.
- Cron route: a `POST` that requires the header `authorization: Bearer ${CRON_SECRET}` (401 otherwise). It calls `drainOutbox(getDb(), handler)`, where handler just logs `row.eventName` for now (real handlers come in P2/P3), and returns `{ processed }`.
- Unit test: the fallback path works when getCloudflareContext throws (mocked).
