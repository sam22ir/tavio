# Wave 6: email, team invitations, provider-neutral AI

## Rules for every task
- **Read first:** `AGENTS.md`, `docs/plan/CONVENTIONS.md`, and a finished module for patterns (`src/modules/contacts/**`, `src/app/[locale]/(app)/contacts/**`).
- **node_modules is a symlink, so never run `pnpm install`.** Use `./node_modules/.bin/<bin>`.
- Edit only the files your task owns. Stubs carry frozen signatures; keep them exactly.
- **No migrations.** Put new tables in the schema file given; the integrator generates the migration.
- **Never hard-code or print secrets.** Read keys from env only (the Workers env via `getCloudflareContext` when present, else `process.env`; follow `src/core/db/client.ts`).
- i18n: fr, ar and en, with real Arabic.
- **Verification:** `./node_modules/.bin/next typegen && ./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/eslint <your paths>`, `./node_modules/.bin/vitest run <your paths>`. DB integration tests are gated with `describe.skipIf(!process.env.TAVIO_W5_DB)`.
- Commit with Conventional Commits and your own model's Co-Authored-By trailer. Don't push. Don't spawn sub-agents or task chips.

## W6-A Email (Resend) and password reset
**Owns:** `src/core/adapters/email/**`, `src/core/auth/server.ts`, `src/core/auth/emails.ts`, `src/app/[locale]/(auth)/forgot-password/**`, `src/app/[locale]/(auth)/reset-password/**`, the "forgot password?" link in `src/app/[locale]/(auth)/auth-form.tsx`, `messages/*/auth.json`
- **sendEmail:** a `fetch` POST to `https://api.resend.com/emails` with `Authorization: Bearer ${RESEND_API_KEY}` and body `{from: EMAIL_FROM, to, subject, html, text, reply_to}`. Return `{sent, id}` or `{sent: false, error}`, and never throw. When it's not configured, `console.info('[email] not configured; would send', subject, '→', redacted(to))`.
- **better-auth:**
  - `emailAndPassword.sendResetPassword` sends a localized email (the locale comes from the reset URL path segment, falling back to fr) with the reset link.
  - `emailVerification.sendVerificationEmail` is wired too, with `sendOnSignUp: true` only when `emailConfigured()`. `requireEmailVerification` stays false.
  - Check the installed better-auth version's API in node_modules.
- **Templates** in `emails.ts`: simple inline-styled HTML plus text, in fr/ar/en (dir="rtl" for ar), for: reset password, verify email, invitation (used by W6-B: `invitationEmail({locale, companyName, inviterName, url})`).
- **Pages:**
  - `/forgot-password`: an email form. It always shows "if an account exists, we sent a link" (no account enumeration).
  - `/reset-password?token=`: new password plus confirm.
  - Both use `authClient` (better-auth: `requestPasswordReset` / `resetPassword`; check the client method names in the installed version).
- **Unit tests:** sendEmail with fetch mocked (configured / not configured / API error), and template rendering per locale.

## W6-B Team members and invitations
**Owns:** `src/core/tenancy/invitations.ts`, `src/core/tenancy/members.ts`, `src/core/db/schema/invitations.ts` (add `export * from './invitations'` to `src/core/db/schema/index.ts`; you may edit that one line), `src/app/[locale]/(app)/settings/team/**`, `src/app/[locale]/invite/[token]/**`, `messages/*/team.json`, `src/core/tenancy/__tests__/*`
- **Table `invitations`:** id, company_id, email (lowercased), role_key, token_hash (sha-256 hex), expires_at (7 days), invited_by, accepted_at, accepted_by, revoked_at, created_at. Unique on (company_id, email) where accepted_at and revoked_at are null.
- **Service** (owner connection plus explicit company checks, like `src/core/tenancy/service.ts`):
  - `createInvitation(userId, companyId, {email, roleKey})`: requires the inviter to be owner or admin, and refuses if the email is already a member. Returns `{url, token}`, and the token is shown once. It also calls `sendEmail(invitationEmail(...))` when configured.
  - `listInvitations` and `revokeInvitation`.
  - `acceptInvitation(userId, token)`: valid if not expired, revoked or accepted. The **user's email must match** the invitation email, otherwise FORBIDDEN. Creates the membership with that role and marks it accepted.
  - Members: `listMembers(companyId)` (via `member_directory` or a join), `changeRole` (can't demote the last owner), `removeMember` (can't remove the last owner or yourself if you're the only owner).
- **Pages:**
  - `/settings/team`: members table with role select and remove; pending invitations with revoke; an invite form. After inviting, it shows the link with a **Copy** button and a **Share on WhatsApp** link (`https://wa.me/?text=` with an encoded message), plus "email sent" when emailConfigured.
  - `/invite/[token]`:
    - Not logged in: show the company name and role, plus buttons to Sign up / Log in that return to this page (pass `?next=`, and make login and signup honour `next`; you may edit `src/app/[locale]/(auth)/auth-form.tsx` for **only** that redirect).
    - Logged in: an Accept button. On accept, set the active company and go to the dashboard.
- Add a "Team" entry to the settings page or menu. Use the existing settings page link list; edit `src/app/[locale]/(app)/settings/page.tsx` to add one link.
- **Tests:** unit tests for token hashing and expiry, plus a gated integration test for invite → accept → membership, the wrong-email refusal, and the last-owner protections.

## W6-C AI core (provider-neutral)
**Owns:** `src/core/adapters/ai/**` (implement the stub, keep `types.ts`), `src/core/ai/usage.ts`, `src/core/db/schema/ai.ts` (add the export line to schema/index.ts), `src/app/[locale]/(app)/settings/ai/**`, `messages/*/ai.json`
- **Adapters:**
  - `openai-compatible`: POST `${AI_BASE_URL}/chat/completions` with Bearer `AI_API_KEY`. Maps images to `image_url` data URLs. With `json`, sends `response_format: {type: 'json_object'}`. Reads usage tokens. Works for OpenAI, DeepSeek, Mistral and Groq.
  - `anthropic`: POST `https://api.anthropic.com/v1/messages` with headers `x-api-key`, `anthropic-version: 2023-06-01`, and the system message mapped to the top-level `system` field.
  - `mock`: deterministic canned replies for tests and dev. It echoes the feature name and returns `{}` for json.
- `getAi()` returns null when `AI_API_KEY` is unset (except mock, which needs no key). `supportsVision` is true when `AI_VISION_MODEL` is set or the provider is anthropic.
- Timeout of 30s; errors become a thrown `AiError` with a code (`AI_UNAVAILABLE`, `AI_BAD_RESPONSE`).
- **Usage table `ai_usage`:** company_id, user_id, feature, provider, model, input_tokens, output_tokens, created_at. `recordAiUsage(ctx, result, feature)` writes under ctx.tx.
- **Rate limiting:** a per-company daily cap via env `AI_DAILY_LIMIT` (default 200 calls), checked with `assertAiQuota(ctx)` (count today's rows), which returns `err('FORBIDDEN','AI_QUOTA')`.
- **Settings page** `/settings/ai`: shows configured or not, the provider name, model (never the key), and this month's usage counts by feature, plus instructions on how to set the secrets with `wrangler secret put`.
- **Unit tests:** each adapter with fetch mocked (request shape, usage parsing, JSON mode), `parseJsonReply`, and null when unconfigured.

## W6-D AI features: reminder drafts and natural-language search
**Owns:** `src/modules/ai_features/reminders/**`, `src/modules/ai_features/search/**`, `src/ui/shell/command-search.tsx`, mounting in `src/ui/shell/shell-nav.tsx` (one import and render line), the "AI draft" button in `src/app/[locale]/(app)/credit/overdue/**`, `messages/*/ai_search.json` (namespace `ai_search`)
- **Reminder drafts:** a server action `draftReminder({contractId, tone: 'polite'|'firm', language: 'fr'|'ar'|'darija'})`.
  - It loads the contract, partner, overdue amount and days late through existing services and asks `getAi()` for a short WhatsApp message (max 400 characters, no threats, includes the amount and shop name). Darija is written in Arabic script.
  - When AI is off, it falls back to the existing `buildReminderMessage` template.
  - It records usage and checks the quota.
  - UI: on the overdue page, an "AI draft" button per row opens a dialog with tone and language selects and an editable text area, plus a "Open WhatsApp" link (`whatsappLink`).
- **Natural-language search:** a `Ctrl+K` / search-button command palette in the shell.
  - The query goes to a server action `interpretQuery(q)`, which asks the AI for JSON `{intent: 'navigate'|'search', module, filters, text}` restricted to a whitelist of routes and filters (contacts, products, credit contracts, overdue, invoices, sales, leads, tickets).
  - It validates with zod and returns a URL with query params. Never execute writes.
  - Without AI, it does plain text search across contacts, products and contracts.
  - Results are shown as a list.
- **Unit tests** with the mock provider: the prompt includes the amount, the whitelist is enforced, and invalid AI JSON falls back to text search.

## W6-E AI features: vendor bill from photo (OCR) and business assistant
**Owns:** `src/modules/ai_features/ocr/**`, `src/modules/ai_features/assistant/**`, `src/app/[locale]/(app)/invoicing/vendors/scan/**`, `src/app/[locale]/(app)/assistant/**`, `messages/*/ai_tools.json` (namespace `ai_tools`)
- **OCR:** on `/invoicing/vendors/scan`, upload a photo or PDF image (max 5 MB, jpeg/png/webp).
  - A server action sends it to `getAi()` (`supportsVision` required) asking for JSON `{supplierName, supplierNif, date, number, lines:[{description, quantity, unitPrice, taxRate}], total}`. Validate with zod.
  - Match the supplier by NIF or name among partners, and products by name (case-insensitive contains).
  - Show an editable review form. On confirm, call `createInvoice` (`@/modules/invoicing/service/create`) with type `in_invoice` as a **draft**; never post automatically.
  - Store the image via `uploadFile` (src/core/files/service.ts) linked to the invoice.
  - Without vision AI, show "configure a vision model" guidance.
- **Assistant:** a `/assistant` chat page.
  - The server answers business questions using **read-only tools** you implement as plain functions: today's KPIs (`dashboardKpis`), overdue list, top customers by revenue this month, low stock, unpaid invoices total.
  - Flow: ask the AI (JSON mode) which tool(s) to call from a fixed list, run them under withTenant, then ask the AI to answer in the user's language using only the tool results. Show the tool results as a small table under the answer.
  - Never write data. Record usage and enforce the quota.
- Add an "Assistant" menu item: put a manifest in `src/modules/ai_features/manifest.ts` (id `ai_features`, depends: []) with menus `/assistant` (order 5) and `/invoicing/vendors/scan` (order 52). Perms `ai_features.assistant.use` and `ai_features.ocr.use`.
- **Unit tests** with the mock provider: tool selection is restricted to the list, malformed OCR JSON is rejected, and no write functions are called.
