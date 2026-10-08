# Tavio Conventions

The rulebook for everyone writing Tavio code, human or agent. It implements `ARCHITECTURE.md`, which wins on any conflict. Table and column details are in `DATA_MODEL.md`. Task scope is in the task files under `docs/plan/`.

If a rule is missing, ask before inventing one, then add it here.

---

## 1. Stack

Next.js 16 (App Router), TypeScript `strict`, pnpm, Drizzle + Postgres (Supabase as managed host), better-auth (server only), next-intl (`fr` default, `ar` RTL, `en`), Tailwind 4 + shadcn/ui wrapped in `src/ui/`, zod, Vitest, Playwright, OpenNext on Cloudflare Workers (cloud) and Node standalone in Docker (on-premise).

Never import `@supabase/*`. Business code reaches Postgres only through Drizzle on the server.

---

## 2. Folder layout

Expands ARCHITECTURE section 4. Paths are from the repo root.

```
src/
  app/[locale]/(auth)/         login, signup, invite
  app/[locale]/(app)/[module]/ module pages. Thin: load via services, render views
  core/                        shared kernel. CONTRACT (section 15)
    db/        client.ts, tx.ts (withTenant), schema/ (core tables only)
    auth/      better-auth setup, requireUser()
    tenancy/   companies, memberships, company switcher
    perms/     permission registry, can(), requirePerm()
    modules/   defineModule(), enabled-modules, registry.generated.ts
    events/    typed in-transaction bus + outbox writer
    audit/     audit_log writer
    sequences/ gap-free next number
    money/     cents helpers, DZD formatting, rounding
    chatter/   messages, activities, followers
    adapters/  storage, pdf, jobs, mail, ai (interfaces + impls)
    i18n/      next-intl config, RTL helpers
    result/    Result, ok(), err(), AppError, error codes
  ui/          shadcn wrappers + generic views: DataList, RecordForm, Kanban, ChatterPanel, SearchBar
  modules/<id>/
    manifest.ts  schema.ts  entities.ts  actions.ts
    service/*.ts  ui/*.tsx  messages/{fr,ar,en}.json  __tests__/
drizzle/       generated and hand-written migrations, one ordered folder
docs/plan/     architecture, conventions, data model, tasks
e2e/           Playwright specs (repo root, not inside modules)
```

Rules:
- `app/` holds no business logic.
- Only `service/` and `actions.ts` import `core/db`. UI components never do.
- A module imports from `core/` and from modules in its `depends`. It never imports another module's `service/` internals. Cross-module work goes through exported service functions or events.
- `registry.generated.ts` is written only by `pnpm modules:gen`. Never hand-edit it.

---

## 3. Naming

| Thing | Convention | Example |
|---|---|---|
| Files, folders | kebab-case | `record-payment.ts`, `credit-sales/` |
| React components | PascalCase | `ContractCard` |
| Functions, variables | camelCase | `recordPayment` |
| Types | PascalCase | `RecordPaymentInput` |
| Module id | snake_case | `credit_sales` |
| URL segments | kebab-case | `/credit-sales/contracts` |
| DB tables, columns | snake_case, tables plural | `crm_leads`, `company_id` |
| Money columns | suffix `_cents` | `total_cents` |
| Permission | `module.entity.action` | `crm.lead.write` |
| Event | `module.entity.past_tense` | `credit_sales.payment.recorded` |
| i18n key | `module.area.key` | `credit_sales.contract.status_label` |
| Error code | SCREAMING_SNAKE_CASE | `NOT_FOUND` |
| Migration | generated, module-prefixed | `0007_crm_init.sql` |

Permission verbs are fixed: `read`, `write`, `post`, `cancel`, and `delete` only for drafts. New verbs need an update here.

Module-owned tables are prefixed with the module id. Core tables are not (`companies`, `memberships`, `audit_log`, `outbox`, `sequences`).

---

## 4. TypeScript

1. No `any`, no `as any`, no `@ts-ignore`. Use `unknown` and narrow. `@ts-expect-error` needs a comment with the reason and the task id.
2. Zod at every boundary: action inputs, route handlers, webhooks, env vars, files, third-party and AI output. Typed internal calls need no zod.
3. Services and actions return `Result<T, AppError>`. Business failures are returned, never thrown.
4. Never let an exception cross an action boundary. Wrap it as `INTERNAL`, log server-side, and never show details to users.
5. Exported functions have explicit return types.
6. No default exports, except where Next.js requires them.
7. No enums. Use string-literal unions or `as const`.
8. No `!` non-null assertions outside tests.

### Result and AppError (in `core/result/`, never redefined in a module)

```ts
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

export type AppError = {
  code: ErrorCode;
  message: string;        // English, developer-facing, for logs
  messageKey?: string;    // i18n key shown to users, e.g. "errors.permission_denied"
  details?: Record<string, unknown>;
};

export const ERROR_CODES = [
  'VALIDATION', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT',
  'POSTED_IMMUTABLE', 'MODULE_DISABLED', 'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = (code: ErrorCode, message: string, messageKey?: string): Result<never> =>
  ({ ok: false, error: { code, message, messageKey } });
```

The UI shows `t(error.messageKey ?? 'errors.' + code.toLowerCase())`, never `error.message`. Adding an error code is a contract change.

---

## 5. Services

Business logic, server only. The signature is always:

```ts
(ctx: Ctx, input: I) => Promise<Result<O, AppError>>
```

`Ctx` comes from `withTenant()` in `core/db/tx.ts`:

```ts
export type Ctx = { userId: string; companyId: string; perms: ReadonlySet<string>; tx: Tx };
```

Required steps, in order:
1. `requirePerm(ctx, '<perm>')` first. It returns a `Result` and rejects permissions missing from the registry.
2. Check preconditions (state, ownership, module enabled). Use `FOR UPDATE` on rows you will change.
3. Work only through `ctx.tx`. Never use the global `db` inside a service.
4. `audit.write(ctx, ...)` in the same transaction.
5. `bus.emit(ctx, event)` in the same transaction.
6. Return `ok(value)`.

Services never open or commit transactions and never read cookies or the session.

```ts
// src/modules/credit_sales/service/record-payment.ts
export async function recordPayment(ctx: Ctx, input: RecordPaymentInput): Promise<Result<{ paymentId: string }>> {
  const perm = requirePerm(ctx, 'credit_sales.payment.write');
  if (!perm.ok) return perm;

  const [contract] = await ctx.tx.select().from(contracts)
    .where(and(eq(contracts.id, input.contractId), eq(contracts.companyId, ctx.companyId)))
    .for('update');
  if (!contract) return err('NOT_FOUND', 'contract not found');
  if (contract.state !== 'active') return err('CONFLICT', 'contract is not active');

  const [row] = await ctx.tx.insert(payments)
    .values({ companyId: ctx.companyId, contractId: contract.id, amountCents: input.amountCents, paidOn: input.paidOn })
    .returning({ id: payments.id });

  await audit.write(ctx, { action: 'create', entity: 'credit_sales.payment', recordId: row.id });
  await bus.emit(ctx, paymentRecorded({ paymentId: row.id, contractId: contract.id, amountCents: input.amountCents }));
  return ok({ paymentId: row.id });
}
```

---

## 6. Server actions

Actions are the only entry from UI to services. An action parses input with zod, converts money, opens the tenant transaction, calls one service, and returns the `Result`.

- File `modules/<id>/actions.ts`, starting with `'use server'`.
- Input is `unknown` until zod parses it.
- Contains no business logic. A business `if` belongs in the service.

```ts
// src/modules/credit_sales/actions.ts
'use server';
const RecordPaymentForm = z.object({
  contractId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),   // DZD as text, e.g. "1500.50"
  paidOn: z.string().date(),
});

export async function recordPaymentAction(raw: unknown): Promise<Result<{ paymentId: string }>> {
  const parsed = RecordPaymentForm.safeParse(raw);
  if (!parsed.success) return err('VALIDATION', 'invalid payment input', 'errors.validation');
  const cents = parseCents(parsed.data.amount);
  if (!cents.ok) return cents;
  const user = await requireUser();
  if (!user.ok) return user;
  return withTenant(user.value, (ctx) =>
    recordPayment(ctx, { contractId: parsed.data.contractId, amountCents: cents.value, paidOn: parsed.data.paidOn }));
}
```

The client checks `result.ok` and shows `t(messageKey)` on failure. Optimistic UI is for reversible actions only.

---

## 7. Modules

### Shape

| File | Purpose |
|---|---|
| `manifest.ts` | `defineModule({ id, version, depends, entities, permissions, menus, events })` |
| `schema.ts` | Drizzle tables owned by this module |
| `entities.ts` | Field metadata for generic views: type, label key, required, list/form/kanban hints, zod schema |
| `service/*.ts` | Business logic, one file per use case |
| `actions.ts` | Server actions |
| `ui/*.tsx` | Module components |
| `messages/{fr,ar,en}.json` | Same keys in all three |
| `__tests__/` | Tests |

### New-module checklist

- [ ] Manifest lists `id`, `version`, `depends`, every permission, menu and event (emitted and handled)
- [ ] Permissions follow `module.entity.action` with allowed verbs
- [ ] `depends` names only existing modules, with no cycles (build fails otherwise)
- [ ] Every table is prefixed, has `company_id`, and has an index led by `company_id`
- [ ] Every tenant table has an RLS policy (hand SQL) and an isolation test
- [ ] `entities.ts` has a zod schema per entity; labels are i18n keys
- [ ] Services follow section 5; actions follow section 6
- [ ] `fr`, `ar`, `en` message files have identical key sets
- [ ] Module added with `pnpm modules:gen`; generated file committed
- [ ] Disabling it is refused while an enabled module depends on it (tested)
- [ ] Tests for each task type in section 13

---

## 8. Money

1. Cents only. Money is an integer count of centimes (1 DZD = 100), typed `bigint` in TypeScript and stored in `bigint` `*_cents` columns.
2. No floats. Never `number`, `parseFloat`, `Number()`, `Math.round`, or `toFixed` on money.
3. Wire format is a decimal string with at most 2 decimals (`"1500.50"`). Convert only with `parseCents()`.
4. Use `core/money` only. Minimum API: `parseCents`, `addCents`, `subCents`, `sumCents`, `applyRateBps` (rates in basis points, TVA 19% = `1900n`), `formatDZD(cents, locale)`. Rounding is half-up to the centime, implemented once in `applyRateBps`.
5. Quantities are `numeric(14,3)`. In TypeScript they are decimal strings handled by `core/money` helpers, never floats.
6. Format through `formatDZD` (`Intl.NumberFormat`). Never build currency strings by hand.
7. Helpers are unit-tested for zero, negative, the largest supported value, and exact .5 rounding.

```ts
const total = addCents(subtotal, applyRateBps(subtotal, 1900n));   // correct
const total = subtotal + subtotal * 0.19;                          // forbidden
```

---

## 9. Database

### Migrations
- Change Drizzle schema, then `pnpm db:generate`. Commit the generated SQL in the same branch.
- Merged migrations are never edited. Fix forward with a new migration.
- Hand-written SQL is only for RLS policies, triggers and DB functions. It goes in a new numbered, module-prefixed file (`0009_credit_sales_rls.sql`).
- Migrations run as the owner. The app connects as `tavio_app`, which cannot bypass RLS.
- CI runs all migrations on a fresh Postgres.

### Tenancy and RLS
- Every tenant table has `company_id uuid not null` referencing `companies`.
- `company_id` leads every index on the table.
- Every tenant table has `ENABLE ROW LEVEL SECURITY` and the policy `company_id = current_setting('app.company_id')::uuid`.
- `withTenant()` runs `SET LOCAL app.company_id` at the start of every transaction. No code opens a tenant connection outside it.
- RLS is the tenant safety net only. Role permissions are checked by `requirePerm`.
- Every tenant table has an isolation test: two companies, one row each, and company A's context can neither read, update, delete, nor insert into company B's rows.

### Posted documents
- A trigger rejects `UPDATE` and `DELETE` when `state = 'posted'`. It is hand SQL on every postable table.
- Corrections use reversal documents, never edits.
- Tested: update and delete on a posted row fail, and the service maps the failure to `POSTED_IMMUTABLE`.

### Other
- Document numbers come from `core/sequences`, which locks `(company_id, code)` in the current transaction. Never use a Postgres sequence, because gaps must not happen.
- Every mutation writes `audit_log` in the same transaction.
- Lists paginate and filter on the server.

---

## 10. Events, audit, chatter

- Events are typed in `modules/<id>/events.ts` and emitted with `bus.emit(ctx, event)`. Handlers run synchronously in the same transaction, so keep them fast and deterministic.
- Slow or fallible work (PDFs, webhooks, reminders, email) goes to `outbox` through `bus.emit`, then to the queue adapter.
- `audit.write(ctx, { action, entity, recordId, before?, after? })` records changes. Store no personal data beyond what is needed.
- Chatter (messages, activities, followers) attaches through `(entity, record_id)`. Tracked field changes create system messages.

---

## 11. Permissions and roles

- Company roles: `owner`, `admin`, `manager`, `staff`. Custom roles come in P8.
- Modules declare their permissions in the manifest. Only declared permissions can be granted.
- `requirePerm` is called at the top of every service. `can()` hides menus and buttons, but it is only a UI hint.
- Record rules (for example, staff see only their own leads) are per-entity filters applied in service queries.
- Users belong to many companies through `memberships`. The active company comes from the header switcher.

---

## 12. UI

### Components
- Build from `src/ui/`. Modules never import shadcn primitives directly.
- Prefer `DataList`, `RecordForm`, `Kanban`, `ChatterPanel` over custom lists and forms.
- New files in `src/ui/` are fine. Changing an existing export is a contract change.

### RTL
- Logical properties only: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `text-end`, `border-s`, `border-e`, `rounded-s-*`, `rounded-e-*`.
- Forbidden: `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `border-l`, `border-r`, `rounded-l-`, `rounded-r-`.
- `ar` sets `dir="rtl"` on `<html>`. Direction-implying icons (arrows, chevrons) flip.

### Mobile first
- Base styles target 360px wide. Add `sm:`, `md:`, `lg:` overrides.
- No horizontal page scroll at 360px. Wide tables scroll inside their own container.
- Every tap target is at least 44px on its smaller side (`min-h-11 min-w-11`), including icon buttons and row actions.
- Keep client bundles small. Images use `next/image`.

### Strings
- No hard-coded user-facing text. Use next-intl keys `module.area.key`, or `common.*` and `errors.*`.
- Add each new key to `fr`, `ar`, `en` in the same change. `fr` sets the wording.
- Format dates and numbers with the active locale.

### Rendering
- Server components by default. Add `'use client'` only for state, effects, browser APIs, or handlers, as low in the tree as possible.
- Forms validate with the `entities.ts` zod schema on the client and call the action. The server validates again.

---

## 13. Tests required per task type

| Task type | Required tests |
|---|---|
| Pure logic (money, schedules, sequences) | Vitest unit: normal, edge, invalid |
| Service function | Integration in a rolled-back transaction: happy path, `FORBIDDEN`, wrong state, audit row, event emitted |
| New or changed tenant table | RLS migration plus two-tenant isolation test |
| Posted-document logic | Trigger test: update and delete rejected; reversal works |
| Server action | zod rejection (`VALIDATION`) and one success through `withTenant` |
| Manifest or module change | Registry builds, dependencies resolve, permissions registered |
| i18n | `fr`, `ar`, `en` key sets identical |
| UI with logic | Vitest + Testing Library |
| User flow | Playwright smoke: login, create contact, create contract, record payment |
| Migration | Runs on a fresh Postgres in CI |

Rules:
- Integration tests run against `docker compose -f docker-compose.test.yml`, each in a transaction that rolls back.
- Tests don't depend on each other's data or order.
- Do not mock the database in service tests. Mock only external adapters (mail, storage, PDF, AI).
- A bug fix includes a test that fails before the fix.
- CI order: typecheck, lint, unit, migrate, integration, build.

---

## 14. Git

- Branch: `task/Pxx-Txx-short-name`, for example `task/P00-T18-latency-probe`. Short name is kebab-case, 3 to 5 words.
- One task per branch. No unrelated changes.
- Conventional Commits: `type(scope): summary`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`. Scope is a module id or `core`, `ui`, `db`, `i18n`, `docs`. Imperative, lowercase, under 72 characters.
- Never push to `main`. Work goes through a PR from the task branch, and the user approves merges.
- No force-push to shared branches. No history rewrites after review starts.
- Never commit secrets, `.env` files, or real customer data. Seed data uses invented names.

---

## 15. Contract files

A task agent may not change these unless the task file explicitly lists the file. If a task needs an unlisted contract file, stop and report it. Do not work around it.

- `src/core/**`
- `docs/plan/DATA_MODEL.md`
- `docs/plan/ARCHITECTURE.md`, `docs/plan/CONVENTIONS.md`
- `src/core/modules/registry.generated.ts` (changed only by `pnpm modules:gen`, when the task calls for it)

Contract changes go in their own commit, prefixed `feat(core)`, `fix(core)` or `docs(plan)`, and are called out in the PR description.

---

## 16. Definition of done

A task is done when all of these hold:

1. Every `verification` command in the task file passes, and CI is green on the task branch.
2. The section 13 tests for the task type exist and test behavior.
3. Only the files the task lists (plus those it needs) changed. Contract changes are listed and called out in the PR.
4. Typecheck passes. No `any`, no `@ts-ignore`, no unexplained `@ts-expect-error`.
5. New permissions are in the manifest, new events in `events`, and new tables have `company_id`, a leading index, and RLS.
6. New strings exist in `fr`, `ar`, `en`. The UI works in RTL with no horizontal scroll at 360px.
7. Money uses `core/money` only.
8. Services write audit and emit events in their transaction. Actions return `Result` and never throw.
9. Migrations are generated. No merged migration was edited.
10. Branch `task/Pxx-Txx-short-name` is pushed and a PR is open against `main`. Nothing was pushed to `main`.
11. The PR description lists changes, verification commands run, and any ARCHITECTURE section 13 risks the change touches.

---

## 17. Open items

- Core table naming (plural, unprefixed) needs confirming in `DATA_MODEL.md`.
- The `core/money` API above is a proposal. The P0 money task fixes the final signatures.
- Lint rules for physical CSS properties and `Number()` on money are planned, not written.
- `e2e/` at repo root for Playwright is a proposal.
