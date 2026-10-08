# P00-T12 Cloudflare Workers build config
Wave 1. Parallel-safe. Check the current @opennextjs/cloudflare docs first.
## Files
- `wrangler.jsonc`: name `tavio`, main `.open-next/worker.js`, compatibility_flags ["nodejs_compat"], a current compatibility_date, assets binding, `placement: { mode: "smart" }`, and a hyperdrive binding `HYPERDRIVE` with id `"REPLACE_ME"` plus a comment
- `open-next.config.ts`
- `package.json`: add only the scripts `cf:build` (`opennextjs-cloudflare build`) and `cf:preview` (`opennextjs-cloudflare preview`)
- `docs/deploy.md`: a short guide to creating Hyperdrive and setting secrets with `wrangler secret put`
## Rules
- **Don't deploy.** Don't run `wrangler login` or `wrangler deploy`, and don't create real resources.
## Verification
`pnpm cf:build` succeeds.
