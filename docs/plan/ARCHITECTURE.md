# Tavio Architecture

Tavio is a modular business suite for Algerian SMEs. It covers credit sales, CRM, invoicing, inventory and accounting, and is sold as SaaS and on-premise.

Research inputs are in `docs/research/00-06`. Items marked ⚠ are unverified or risky.

## 1. Principles
1. **Keep Odoo's concepts, not its stack.** We keep modules with dependencies, shared contacts and products, a chatter feed, kanban, list and form views, record rules, and localization packs. None of Odoo's code is copied.
2. **TypeScript everywhere.** One codebase serves the cloud (Cloudflare Workers) and on-premise (Node in Docker).
3. **Business logic needs only plain Postgres.** It doesn't depend on Supabase-only features.
4. **Money logic runs on the server, inside transactions.** Posted documents can't be changed.
5. **Simple first.** Pages must work on cheap phones and slow connections. French is the default language, then Arabic (right-to-left), then English.
6. **Small, explicit contracts** that cheap agents can implement in parallel.

## 2. Stack options compared (ADR-001)

| | A. Next.js + Postgres + Drizzle + better-auth (**chosen**) | B. Full Supabase (supabase-js, Supabase Auth, RLS as the main auth layer) | C. Node API server (Hono) on a VPS + SPA |
|---|---|---|---|
| Runtime | Workers via OpenNext (cloud), Node standalone (on-prem) | Workers + Supabase | VPS |
| Lock-in | Low. Any Postgres works. | High: auth, RLS model, client SDK | Low |
| On-premise | Postgres + app container | Self-host the full Supabase stack (about 10 containers) | Simple |
| Speed to start | Medium | Fast (what the old app did) | Medium |
| Authorization | Service layer + RLS as a safety net | Mostly RLS, which is hard to test and reason about | Service layer |
| Cost at 1000 tenants | 1 Supabase Pro project + Workers paid + R2 | Same | VPS + ops time |
| Risks | ⚠ better-auth maturity, ⚠ OpenNext edge cases | Lock-in, client-side data access | No edge, you run the ops |

**Decision: A.** Supabase is used as managed Postgres in Paris (eu-west-3), along with its pooler, backups and PITR. We don't use Supabase Auth, supabase-js data access or Supabase Storage. Business code talks to Postgres only through Drizzle on the server. This keeps on-premise as "Postgres + one app container" and leaves room for hosting in Algeria later (Law 18-07). You can overturn this if you want Supabase Auth, but that brings the lock-in listed under B.

## 3. Database decision (ADR-002): the eight risks
1. **Latency.** There's no Supabase region in Algeria; Paris is closest. ⚠ Measure it in P0 (task P00-T18 pings from a Djezzy/Mobilis/ADSL line). Mitigations:
   - Workers Smart Placement runs the Worker near the database.
   - Hyperdrive pools connections.
   - Screens need one round trip each, with optimistic UI and pagination.
   - Static assets are served from the CDN.
2. **Law 18-07.** ⚠ This needs a lawyer. It reportedly requires prior ANPDP authorization for transfers abroad and was amended by Law 25-11 (2025). Mitigations:
   - Users agree to the processing.
   - We minimize what we collect: national ID photos are optional and encrypted at rest in R2.
   - Hosting stays portable: an on-premise tier, and a later "hosted in Algeria" tier on a local provider, made possible by plain Postgres.
3. **On-premise.** `docker compose` runs postgres:17, tavio-app (Next standalone), gotenberg (PDF) and minio (files). Adapters behind interfaces: `Storage`, `PdfRenderer`, `JobRunner`, `Mailer`. Auth is the same better-auth in both environments.
4. **Accounting integrity.**
   - Money is stored as **bigint centimes** (`amount_cents`), so there's no float anywhere. Quantities are `numeric(14,3)`.
   - Every money mutation runs in one service-layer transaction, with `SELECT … FOR UPDATE` where needed.
   - Posted rows can't be changed: a trigger rejects UPDATE or DELETE when `state = 'posted'`. Corrections are made through reversal documents.
   - Gap-free numbering: the `sequences` table is locked per (company, code) inside the same transaction.
   - Every mutation writes to `audit_log` in the same transaction.
5. **RLS pitfalls.**
   - RLS handles **tenant isolation only**: `company_id = current_setting('app.company_id')::uuid`, set with `SET LOCAL` at the start of every transaction by `withTenant()`.
   - Role permissions are enforced in the service layer.
   - Each policy is tested against two tenants.
   - `company_id` is the leading column of every index.
   - The app connects as a non-owner role (`tavio_app`), which can't bypass RLS. Migrations run as the owner.
6. **Cost.**
   - Supabase Pro is one project for all tenants. ⚠ Confirm current pricing and the PITR add-on before launch.
   - Workers paid plan, R2 for files and Hyperdrive.
   - ⚠ PITR covers 7–14 days, while Algerian records must be kept for about 10 years (needs accountant verification). Nightly `pg_dump` exports go to R2 in another account.
7. **Migrations and modules.**
   - Drizzle schema files live per module. Generated SQL migrations go in one ordered `drizzle/` folder, and every file name is prefixed with its module (`0007_crm_init.sql`).
   - RLS policies and triggers are written as hand-made SQL migrations.
   - Module tables always exist. Enabling a module per tenant is a row in `company_modules`, checked by menus and the service layer.
8. **Vendor risk.**
   - Exit plan: `pg_dump` and restore to any Postgres 15+, tested each quarter (task in P0 CI docs).
   - Backups are copied outside Supabase.
   - Nothing in the code imports `@supabase/*`.

## 4. Repository layout
One Next.js app, no monorepo tooling, to keep it simple for agents.
```
src/
  app/[locale]/(auth)/…          login, signup, invite
  app/[locale]/(app)/[module]/…  module pages (thin: load data, render views)
  core/                           shared kernel. Contract files need approval to change.
    db/        client.ts, tx.ts (withTenant), schema/ (core tables)
    auth/      better-auth setup, session, requireUser()
    tenancy/   companies, memberships, current company switcher
    perms/     permission registry, can(), requirePerm()
    modules/   defineModule(), registry.generated.ts, enabled-modules
    events/    typed bus (in-transaction) + outbox
    audit/     audit log writer
    sequences/ next number (gap-free)
    money/     cents helpers, DZD formatting, rounding
    chatter/   messages, activities, followers
    adapters/  storage, pdf, jobs, mail, ai (interfaces + impls)
    i18n/      next-intl config, rtl helpers
  ui/          design system (shadcn-based) + generic views: DataList, RecordForm, Kanban, ChatterPanel, SearchBar
  modules/<id>/
    manifest.ts      defineModule({...})
    schema.ts        Drizzle tables
    entities.ts      entity metadata (fields, views)
    service/*.ts     business logic (server only)
    actions.ts       server actions (zod in, Result out)
    ui/*.tsx         module-specific components
    messages/{fr,ar,en}.json
    __tests__/
drizzle/            generated + hand SQL migrations
docs/plan/          this plan, tasks
```

## 5. Module system
```ts
defineModule({
  id: 'credit_sales', version: '1.0.0', depends: ['contacts', 'products'],
  entities: [contractEntity, installmentEntity],     // metadata → views
  permissions: ['credit_sales.contract.read', '…write', '…post', '…cancel'],
  menus: [{ label: 'menu.contracts', href: '/credit-sales/contracts', perm: '…read' }],
  events: { emits: ['credit_sales.payment.recorded'], handles: { 'contacts.partner.merged': handler } },
})
```
- `pnpm modules:gen` writes `registry.generated.ts` with static imports. Workers can't load code dynamically.
- At build time, a dependency check fails if a module is missing or there's a cycle.
- Enabling a module also enables everything it depends on. Disabling is refused while another enabled module depends on it.
- **Entity metadata** (fields with type, label key, required, list/form/kanban hints, zod schema) drives the generic `DataList`, `RecordForm` and `Kanban`. Custom fields come later (P8) in a `custom jsonb` column described by `custom_field_defs` rows.

## 6. Data access and API
- **The internal API is server actions.** Each one validates input with zod, then calls `service.fn(ctx, input)` and returns `Result<T, AppError>`. There's no tRPC, so there's less tooling.
- `ctx = { userId, companyId, perms, tx }` is always built by `withTenant()`. Services never read globals.
- **The public API** is a REST/OpenAPI layer over the same services, using API keys per company plus webhooks from the outbox. That's P8.
- Reads in lists use server-side pagination, filtering, sorting and group-by. Filters live in the URL.

## 7. Events, jobs and chatter
- `bus.emit(ctx, event)` runs synchronous handlers **in the same transaction** and writes async work to the `outbox` table.
- Cloud: a Cron Trigger every minute drains the outbox into Cloudflare Queues (reminders, webhooks, PDFs). On-premise: a node worker polls the outbox.
- **Chatter** links to any record through `(entity, record_id)`:
  - `messages` (comment, note, system tracking)
  - `activities` (type, due date, assignee, done)
  - `followers`
  
  Field changes on tracked fields create system messages automatically.

## 8. Permissions
- Roles are defined per company: `owner`, `admin`, `manager`, `staff`, plus custom roles later. Each role is a set of permission strings.
- `requirePerm(ctx, 'crm.lead.write')` is checked in every action. Menus are filtered by `can()`.
- Record rules are service-level filters declared per entity, for example "staff see only their own leads".
- Users ↔ companies is many-to-many (`memberships`), and the company switcher lives in the header. This fixes the old app's one-shop limit.

## 9. Localization (Algeria)
- The `l10n_dz` module holds dated **configuration data, not code**: tax rates (TVA 19% / 9%), stamp-duty tiers, invoice mentions, identifier fields (NIF, NIS, RC, AI) and the SCF chart. ⚠ Every value needs accountant verification, and an accountant can edit them.
- Currency is DZD with 2 decimals. Formatting comes from `Intl.NumberFormat('fr-DZ' | 'ar-DZ')`.
- i18n uses next-intl with `fr` as the default. `ar` sets `dir="rtl"`, and styles use only Tailwind logical properties (`ms-`, `pe-`, `start-`).

## 10. PDF and files
- Documents are HTML/React templates rendered to PDF by the `PdfRenderer` adapter: Cloudflare Browser Rendering in the cloud, Gotenberg on-premise.
- We chose HTML because Arabic shaping is unreliable in react-pdf and pdf-lib. ⚠ Check Browser Rendering limits and cost.
- Files go to R2 (cloud) or MinIO (on-premise) through the `Storage` adapter, with private buckets and signed URLs.

## 11. AI (our edge, P3 and later)
`AiProvider` is an interface with a Claude implementation. Planned uses:
- reminder message drafts (Darija, French, Arabic)
- natural-language search
- invoice and ID OCR
- client risk scoring

AI suggestions never change money records without a human confirming.

## 12. Testing and CI
- **Vitest** for unit tests on pure logic: money, schedules, sequences.
- **Integration tests** run against Postgres from `docker compose -f docker-compose.test.yml`. Each test runs in a transaction that is rolled back. Tenant-isolation tests are required for every table.
- **Playwright** smoke tests: log in, create a contact, then a contract, then a payment.
- **GitHub Actions:** typecheck → lint → unit → migrate a fresh Postgres → integration → build.
- A task's done only when its stated `verification` commands pass.

## 13. Open risks
- ⚠ Unmeasured latency from Algeria to Paris.
- ⚠ Legal and tax values.
- ⚠ OpenNext and Next 16 compatibility on Workers.
- ⚠ Browser Rendering cost.
- ⚠ better-auth maturity.
- Scope: Odoo took 15+ years. The first sellable version is P0–P3 only.
