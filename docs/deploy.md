# Deploying Tavio to Cloudflare Workers

Tavio builds with OpenNext for Cloudflare. Config lives in `wrangler.jsonc` and `open-next.config.ts`.

## Build locally

```bash
pnpm cf:build     # writes .open-next/ (worker and assets)
pnpm cf:preview   # runs the built worker locally with wrangler
```

## Create the Hyperdrive config

Hyperdrive pools connections from the Worker to the Postgres database (Supabase).

```bash
wrangler hyperdrive create tavio-db --connection-string="<postgres connection string>"
```

Copy the id it prints into `wrangler.jsonc`, replacing `REPLACE_ME` in the `hyperdrive` entry.
Use the connection string for the `tavio_app` role, never the owner role. Do not commit it.

## Set secrets

Secrets go in Wrangler, never in `wrangler.jsonc` or the repo:

```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put DATABASE_URL
```

Add each further secret the same way (`wrangler secret put <NAME>`), then deploy with `pnpm exec opennextjs-cloudflare deploy` once the owner approves.
