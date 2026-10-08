# Existing app audit: installment-app

Source: `/home/saadi/Documents/installment-app`, read-only audit, 2026-10-08.

## Stack
- Next 16.4, React 19.3, TypeScript 5, ESLint 9, Tailwind 4, no component library
- Supabase (supabase-js 2.117, @supabase/ssr 0.12), no ORM
- next-intl 4.14 with `messages/fr.json` and `messages/ar.json` (332 keys each)
- OpenNext on Cloudflare Workers (wrangler 4)
- No tests, no CI. Only lint and build scripts.

## Structure
- `src/app/[locale]/(app)/`: dashboard, sales, customers, products, payments, overdue, receipts/[id], settings, onboarding
- `src/app/[locale]/(auth)/`: login, signup
- `src/components/`, `src/lib/` (auth, sales, payments, customers, products, storage, supabase, dates.ts), `src/i18n/`, `src/proxy.ts`
- `supabase/migrations/0001` to `0006` (plain SQL)
- `.claude/worktrees/` holds about 20 stale worktrees. Ignore them.

## Database
- Tables:
  - `shops`
  - `shop_members` (owner or staff)
  - `customers` (national_id, id_photo_path, employer, salary, guarantor fields)
  - `products` (price, stock_qty)
  - `sales` (total, markup, down_payment, installments_count, monthly frequency only, status active/completed/cancelled)
  - `installments` (seq, due_date, amount, amount_paid, status upcoming/partial/paid/late)
  - `payments` (method cash/card/transfer)
  - `receipts` (number unique per shop)
- Tenancy: `shop_id` on every row, with RLS policies `<table>_shop_access` and a private storage bucket `id-photos`.
- RPCs and functions: create_sale, cancel_sale, create_installment_schedule (plus a trigger), record_payment (SECURITY DEFINER, row locks, per-shop receipt numbers), create_shop, add_staff, is_shop_member, is_shop_owner, shop_dashboard_stats, overdue_list, upcoming_list.
- Schedule rule: financed amount = total - down payment. Each installment is trunc(financed / n), and the last one takes the remainder. Months step forward with end-of-month clamping. `src/lib/sales/schedule.ts` mirrors this rule in TypeScript.

## Auth
- Supabase email/password login. `proxy.ts` refreshes the session.
- The server client uses the anon key plus cookies.
- Authorization relies on RLS plus membership checks in server actions.

## Gaps and risks
- A user can belong to only one shop (`limit(1)` in `src/lib/auth/shop.ts`), which blocks multi-company.
- The `late` status is stored but never updated. Overdue is derived on read.
- There are no tests for money logic (rounding, partial payments, cancellation).
- SECURITY DEFINER RPCs need a review of search_path and grants.
- Receipts are browser-print only. There's no server PDF and no contract PDF.
- Reminders are only call and WhatsApp links.
- Secrets: `.env.local` and `supabase/.db.env` are gitignored and were never committed (checked with git).

## Verdict
Keep the SQL schema, the RLS tenancy model, the money RPCs (locking and numbering) and `schedule.ts` as reference. Rewrite the app shell around multi-shop membership, a module registry and tests.
