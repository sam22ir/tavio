# Tavio

A modular business suite for Algerian SMEs. It covers credit (installment) sales, CRM, contacts, products and Algerian tax settings, in French, Arabic (RTL) and English.

- **Live:** https://tavio.nafaa-store.workers.dev
- **Plan and architecture:** [docs/plan/](docs/plan/) (ARCHITECTURE, DATA_MODEL, ROADMAP, CONVENTIONS, task waves)
- **Research:** [docs/research/](docs/research/)

## Stack
Next.js 16 on Cloudflare Workers (OpenNext), Postgres (Supabase, Paris) through Hyperdrive, Drizzle, better-auth, next-intl, Tailwind 4 and shadcn/ui. Every tenant table is protected by row-level security through the `tavio_app` role.

## Develop
```bash
pnpm install
pnpm dev            # needs DATABASE_URL / BETTER_AUTH_SECRET (see .env.example or ~/.config/tavio/test.env)
pnpm typecheck && pnpm lint && pnpm test && pnpm test:int
pnpm db:generate    # after schema changes; hand-written SQL via drizzle-kit generate --custom
pnpm db:migrate
pnpm db:seed        # global units and currencies
```

## Deploy (Cloudflare)
```bash
pnpm cf:build
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$DATABASE_URL" pnpm exec opennextjs-cloudflare deploy
```
Worker secrets: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CRON_SECRET` (set with `wrangler secret bulk`). Cron triggers call `/api/cron/outbox` (every 5 min) and `/api/cron/daily` (06:00 UTC). See [docs/deploy.md](docs/deploy.md).

⚠ Tax rates, stamp duty, invoice mentions and Law 18-07 handling need verification by an Algerian accountant and lawyer before commercial use.
