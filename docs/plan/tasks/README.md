# Task dispatch

## Rules for the orchestrator
- Each task runs in its own git worktree at `/home/saadi/tavio-wt/<ID>` on branch `task/<ID>` (created with `git worktree add`), done by a Haiku 5.5 agent at low effort.
- Run a whole wave in parallel. **After `git worktree add`, symlink `node_modules` to `/home/saadi/tavio/node_modules`.** On this machine pnpm copies (no hardlinks), and many parallel installs saturate the disk. Agents must not run `pnpm install` unless their task adds a dependency. Task agents don't run `next build` or dev servers; build runs once at integration.
- The agent's prompt is: "Do the task in docs/plan/tasks/<file>. Follow docs/plan/CONVENTIONS.md. Report: files changed, verification output (pass/fail), and any questions. Do not edit files outside the task's list."
- If a task fails, send it to a fresh agent with the error output.
- **Integration after each wave** (orchestrator or reviewer):
  1. Merge the branches.
  2. Run `pnpm install` to regenerate the lockfile.
  3. Run `pnpm db:generate` once, and apply with `pnpm db:migrate` against the dev Supabase project. Tasks never generate migrations themselves.
  4. Run the full verification: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:int && pnpm build`.
- **Contract files** may only be changed by the task that lists them, or by the orchestrator:
  - `src/core/result.ts`
  - `src/core/ctx.ts`
  - `src/core/db/types.ts`
  - `src/core/db/schema/index.ts`
  - `docs/plan/DATA_MODEL.md`
- Secrets live in `~/.config/tavio/` (outside the repo). Agents may load them only through `loadDevEnv()` or `set -a; . ~/.config/tavio/test.env`, and must never print or copy them.
- A task may add only the dependencies it lists. Everything else is installed by P00-T01.

## Waves
| Wave | Tasks | Parallel |
|---|---|---|
| 0 | P00-T01 scaffold and contracts | 1 agent |
| 1 | P00-T02 … P00-T13 | 12 agents, disjoint files |
| 2 | RLS and roles migration, tenancy service, sequences, audit, event bus and outbox, auth pages, app shell and switcher, generic DataList/RecordForm, file storage adapter, PDF adapter | planned after Wave 1 integration |
