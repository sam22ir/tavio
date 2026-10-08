# 06 Tech stack research

Date: 2026-10-08. "Unverified" marks points not confirmed in a source.

## 1. Supabase Postgres vs D1
- D1 limits (Paid / Free): 10 GB per database (not raisable), 1,000 / 50 queries per invocation, 30 s max query or batch, 6 connections per invocation. Each database is one single-threaded Durable Object: about 1,000 qps at 1 ms queries, about 10 qps at 100 ms. Time Travel retention 30 d (Paid) / 7 d (Free).
- Verdict: D1 is not fit as the primary accounting ledger (single writer, size cap, thin transaction docs). Supabase Postgres fits: serializable transactions, constraints, RLS, PITR.

## 2. Workers to Postgres
- Hyperdrive: regional pool, transaction mode, minimum 5 connections per config, soft max by plan. Named prepared statements only with postgres.js and node-postgres.
- Supavisor: direct (5432, IPv6 unless add-on), session (5432, IPv4), transaction (6543, IPv4, serverless), dedicated pooler (paid).
- Transaction mode drops prepared statements, SET state, LISTEN/NOTIFY and temp tables. Use pool size 1 per isolate and disable prepared statements.
- Recommendation: Hyperdrive in front of Supabase, one path only. Whether Hyperdrive is specifically documented for Supabase: unverified.

## 3. Drizzle vs Kysely vs Prisma
- Drizzle: runs on Workers with node-postgres or postgres.js; create client per request (React `cache()`), `maxUses: 1`. Small bundle. Migrations via drizzle-kit; per-module folders need a custom runner.
- Kysely: `PostgresDialect` over `pg`; built-in migrator suits per-module migrations. Workers-specific guidance: unverified.
- Prisma: needs driver adapters and `nodejs_compat`; free-plan bundle 3 MB; heavier generation step.
- Recommendation: Drizzle with per-module SQL migrations.

## 4. Pricing and self-hosting
- Supabase list (supabase.com/pricing): Free $0 (500 MB DB, 5 GB egress, 50k MAU). Pro from $25/mo (8 GB DB, 250 GB egress, 100k MAU, $10 compute credit). Team from $599/mo.
- PITR: $100/mo per 7 days (14 d about $200, 28 d about $400), requires Small compute; replaces daily backups (Pro keeps 7 days, Team 14).
- Compute: Micro $10, Small $15, Medium $60, Large $110.
- Estimate for one shared project with Small or Medium compute and PITR at 14 days: about $240 to $285/mo. Per-tenant projects multiply cost by tenant count (10x, 100x, 1000x), so use one shared database with `tenant_id` and RLS.
- Self-hosting Supabase: cost is server and ops time (Postgres, GoTrue, PostgREST, Storage, Realtime, Studio, Kong, Supavisor). For on-prem, plain Postgres with better-auth is smaller. Server cost per GB: unverified.

## 5. Latency to Algeria
- Cloudflare has PoPs in Algiers and Annaba, so Workers run locally; the database hop determines latency.
- Paris (eu-west-3) and Frankfurt (eu-central-1) are about 11.5 ms apart on AWS (third party). No published RTT from Algeria to either. Unverified.
- Recommendation: start with Paris, benchmark both with a probe Worker before committing. A Paris CDG incident was posted July 2026; check whether it is still open.

## 6. RLS and pgTAP
- Use `(select auth.uid())` so the planner caches it.
- Index every policy column; a composite PK does not index its second column.
- Use `security definer` functions with `search_path = ''` to avoid recursive policies (42P17).
- Enable RLS on every table in exposed schemas; grants apply regardless.
- Tests: pgTAP files in `supabase/tests/database/`, `select plan(n)`, assertions, `finish()`, rollback; run `supabase test db` (CLI 1.11.4+). RLS helper pattern (`set role`, JWT claims) is on the linked "Testing RLS" page, not fetched.

## 7. Workers limits and async
- CPU per request: Free 10 ms; Paid default 30 s, configurable to 5 min. Cron: 30 s (under 1 h interval) or 15 min.
- Bundle: 64 MiB uncompressed, both plans. Memory 128 MB. Subrequests: Free 50, Paid 10,000.
- Queues and Cron consumer wall time: 15 min each. Cron Triggers: 5 Free, 250 Paid.
- PDF: Browser Run (formerly Browser Rendering) includes 10 browser hours/mo on Paid, then $0.09/hr; PDF support not confirmed. Prefer pdf-lib or server rendering for invoices; use browser rendering only for HTML fidelity at low volume.

## 8. i18n and RTL (next-intl)
- Prefix routing by default with cookie and accept-language fallback; `proxy.ts` on Next.js 16+.
- next-intl docs do not cover `dir`. Set `<html lang dir>` per locale in the root layout; use logical CSS properties and Tailwind `rtl:`. Test DZD and Arabic-numeral formatting in invoice PDFs.

## 9. tRPC vs REST/OpenAPI
- tRPC: type-safe internal API; runs on Workers via fetch adapter (docs fetch failed; from knowledge).
- REST/OpenAPI: needed for external integrations and on-prem clients.
- Recommendation: tRPC for the web app, OpenAPI generated from the same Zod schemas for public and on-prem API. Money logic stays in shared domain packages.

## Recommended stack
- Next.js on Workers via OpenNext.
- Supabase Postgres, one shared project, RLS by `tenant_id`, Paris region, Hyperdrive transaction mode.
- Drizzle with per-module SQL migrations.
- Auth: Supabase Auth (cloud); better-auth on plain Postgres (on-prem).
- Queues and Cron Triggers for async work and period close.
- pdf-lib or server rendering for invoices.
- next-intl with `dir` per locale; Arabic first, French second.
- tRPC internally, OpenAPI externally.
- pgTAP for RLS and money invariants.

## Risks
1. Per-tenant Supabase projects multiply cost; keep one shared project.
2. Transaction-mode pooling breaks prepared statements and SET-based tenant context; set tenant with transaction-local `set_config`.
3. PITR at 14 days may not meet Algerian accounting retention; confirm the legal requirement.
4. Algeria to Paris latency is unmeasured.
5. PDF support in Browser Run is unconfirmed.
6. On-prem needs two auth paths tested.
7. 15-min Queue and Cron wall time: chunk period-close jobs.
8. Vendor pricing changes often.

## Sources
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/hyperdrive/concepts/connection-pooling/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/browser-rendering/pricing/
- https://supabase.com/pricing
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/testing
- https://supabase.com/docs/guides/platform/backups
- https://orm.drizzle.team/docs/get-started-postgresql
- https://www.prisma.io/docs/orm/prisma-client/deployment/edge/deploy-to-cloudflare
- https://opennext.js.org/cloudflare/howtos/db
- https://kysely.dev/docs/getting-started
- https://next-intl.dev/docs/routing/middleware
- https://next-intl.dev/docs/getting-started/app-router
