# Wave 5: P4–P8 (sales, invoicing, inventory, purchases, accounting, POS, HR, projects, helpdesk, website, marketing, platform)

Each task builds **one module end to end**: schema, manifest, entities, service, actions, pages, messages and tests. The worktree's `node_modules` is a symlink, so **never run `pnpm install`**. Run binaries from `./node_modules/.bin/`.

## Read first
- `AGENTS.md`
- `docs/plan/CONVENTIONS.md`, `docs/plan/DATA_MODEL.md` §0 (conventions) and §6 (P4–P6 outline)
- `docs/plan/ROADMAP.md` §6
- A finished module to copy patterns from: `src/modules/contacts/**` and `src/app/[locale]/(app)/contacts/**` (service, actions, pages), plus `src/modules/credit_sales/**` (money, numbering, events)
- `src/core/events/catalog.ts` (event payloads), `src/core/entities/types.ts`, `src/ui/views/*`, `src/core/actions/{define-action,page-ctx}.ts`, `src/core/sequences`, `src/core/audit`, `src/core/money`

## Rules for every task
- **Module folder:** `src/modules/<id>/`, with `schema.ts`, `manifest.ts` (`export const manifest = defineModule(...)`), `entities.ts`, `index.ts`, `service/*`, `actions.ts`, `ui/*`, `events.ts` (handlers, if any) and `__tests__/*`. Pages go in `src/app/[locale]/(app)/<route>/**`, and i18n in `messages/{fr,ar,en}/<ns>.json`. The ns files exist and are empty; fill all 3 languages, with real Arabic.
- **Schema:**
  - Common columns are id uuid defaultRandom, created_at, updated_at and created_by uuid.
  - Tenant tables have `company_id uuid not null` referencing companies.
  - Money is `bigint({mode:'bigint'})` `*_cents`, quantities `numeric(14,3)`, rates `numeric(7,4)`.
  - Document `state` is text with a CHECK list.
  - Indexes lead with company_id.
  - Table names are plural snake_case and must be **unique across the app**. Use the names given below.
  - You may import tables from these existing modules for FKs: `contacts` (partners), `products` (products, uoms), `l10n_dz` (taxes), `core` (companies). **Never import another Wave 5 module's schema.** Leave a comment instead, for example `// FK → invoices.id (integrator)`.
- **No migrations, no RLS SQL.** The integrator generates them.
- **Money logic:** server-side only, inside `ctx.tx`. Gap-free numbers come from `nextNumber`. Every mutation is audited. Posted documents can't be changed: corrections are new documents such as refunds and reversals, and services must return `err('POSTED_IMMUTABLE', …)` when asked to edit them.
- **Cross-module:**
  - Talk to other Wave 5 modules **only** through events from `src/core/events/catalog.ts`. Emit with `emit(ctx, { name, payload })` and handle in `events.ts` with `on(name, handler)`.
  - The one allowed direct call is `createInvoice` from `@/modules/invoicing/service/create` (sales and purchases only).
  - Handlers must be idempotent: check by source id before creating anything.
- **UI:** list (DataList), new/edit (RecordForm or a custom form), and a detail page with state actions and `<Chatter entity="<id>.<entity>" recordId>`. It must work at 360px and in RTL.
- **Manifest:** menus with i18n label keys, perms `<id>.<entity>.<read|write|…>`, and order as given. `depends` lists only P0–P3 modules plus `invoicing` where you call createInvoice.
- **Verification:**
  - `./node_modules/.bin/next typegen && ./node_modules/.bin/tsc --noEmit`
  - `./node_modules/.bin/eslint src/modules/<id> "src/app/[locale]/(app)/<route>"`
  - `./node_modules/.bin/vitest run src/modules/<id>`
  
  Integration tests (`*.int.test.ts`) need the DB tables, which don't exist until integration. So write them, but mark the suite `describe.skipIf(!process.env.TAVIO_W5_DB)`. The integrator runs them after migrating. Pure logic (totals, tax rounding, state machines) must have unit tests that run now.
- Commit with Conventional Commits and your own model's Co-Authored-By trailer. Don't push. Never print `~/.config/tavio/*`.

---
## W5-A sales (ns `sales`, route `/sales`, menu order 50)
- **Tables:** `sale_orders` (number, partner_id, state draft/sent/confirmed/cancelled/done, order_date, validity_date, salesperson_id, note, untaxed_cents, tax_cents, total_cents, invoiced boolean) and `sale_order_lines` (product_id, description, quantity, unit_price_cents, discount_rate, tax_id, subtotal_cents, tax_cents).
- **Service:** CRUD for drafts. Compute totals with `@/core/money` (tax per line = applyRate(subtotal, tax rate)).
  - `confirmOrder`: number `SO-{YYYY}-`, then emit `sales.order.confirmed`.
  - `cancelOrder`.
  - `createInvoiceFromOrder`: calls createInvoice with type out_invoice and sourceEntity 'sales.order', then sets invoiced.
- **Pages:** quotations and orders list, new, and detail with Confirm / Create invoice / Cancel / Print (an HTML quotation print view).

## W5-B invoicing (ns `invoicing`, routes `/invoicing/customers` and `/invoicing/vendors`, order 51)
- **Tables:**
  - `invoices`: type out_invoice/out_refund/in_invoice/in_refund, number nullable until posted, partner_id, state draft/posted/cancelled, date, due_date, origin, source_entity, source_id, refund_of_id, untaxed_cents, tax_cents, stamp_cents, total_cents, paid_cents, payment_state not_paid/partial/paid.
  - `invoice_lines`.
  - `invoice_payments`: invoice_id, amount_cents, method cash/ccp/transfer/cib/edahabia/cheque, date, reference.
- **Service:**
  - Implement the stub `src/modules/invoicing/service/create.ts`.
  - `postInvoice`: numbers per type (out_invoice `FAC-{YYYY}-`, out_refund `AV-{YYYY}-`, in_invoice `FF-{YYYY}-`, in_refund `AVF-{YYYY}-`). Stamp duty (timbre) applies only to out_invoice paid in cash, using `DZ_STAMP_DUTY_TIERS` from `@/modules/l10n_dz` ⚠, and is computed at payment time. Emit `invoicing.invoice.posted`.
  - `cancelInvoice`: drafts only.
  - `createRefund(invoiceId)`.
  - `registerPayment` (≤ residual): updates paid and payment_state, emits `invoicing.payment.registered`.
  - Any edit of a posted invoice returns POSTED_IMMUTABLE.
- **Pages:** customer invoices, vendor bills, detail with Post / Register payment / Refund, and a print view with Algerian mentions:
  - seller legal name, NIF, NIS, RC, AI and address
  - buyer identifiers
  - number, date, lines, VAT per rate, stamp duty, total in figures
  - the HTML comment `<!-- ⚠ needs accountant verification -->`
  
  Plus a PDF route like `/api/credit/receipts/[id]/pdf`.

## W5-C inventory (ns `inventory`, route `/inventory`, order 52)
- **Tables:**
  - `warehouses`.
  - `stock_locations`: warehouse_id nullable, type internal/customer/supplier/inventory_loss.
  - `stock_moves`: reference, product_id, quantity, from_location_id, to_location_id, state draft/done/cancelled, source_entity, source_id, done_at.
  - `reorder_rules`: product_id, warehouse_id, min_qty, max_qty.
- **Stock on hand** = sum of done moves into internal locations − out. Compute it with a SQL query; there's no quants table. Also `ensureDefaultWarehouse(ctx)`, which creates a warehouse plus the internal, customer, supplier and loss locations.
- **Service:** create and validate moves (validation emits `inventory.move.done`), inventory adjustment, stock levels by product, and low-stock list from reorder rules.
- **events.ts:**
  - On `sales.order.confirmed`: create draft delivery moves (internal → customer).
  - On `purchases.order.received`: create **done** receipt moves (supplier → internal).
  - On `pos.order.paid`: done moves (internal → customer).
  - Ignore lines without a productId. Be idempotent by source_id + product.
- **Pages:** stock levels, moves list with Validate, warehouses, adjustments, low stock.

## W5-D purchases (ns `purchases`, route `/purchases`, order 53)
- **Tables:** `purchase_orders` (number `PO-{YYYY}-`, partner_id supplier, state draft/sent/confirmed/received/cancelled, order_date, expected_date, totals, billed boolean) and `purchase_order_lines` (with received_qty).
- **Service:** CRUD and confirm.
  - `receiveOrder(id, lines?)`: full or partial receipt. Updates received_qty and emits `purchases.order.received` with the received quantities.
  - `createBillFromOrder`: createInvoice in_invoice.
- **Pages:** list, new, and detail with Confirm / Receive / Create bill.

## W5-E accounting (ns `accounting`, route `/accounting`, order 54)
- **Tables:**
  - `accounts`: code, name, class 1–7, type asset/liability/equity/income/expense, reconcilable.
  - `journals`: code, name, type sale/purchase/cash/bank/general.
  - `journal_entries`: number, journal_id, date, ref, source_entity, source_id, state draft/posted, reversed_by_id.
  - `journal_lines`: entry_id, account_id, partner_id, label, debit_cents, credit_cents, CHECK exactly one side > 0.
- **SCF chart seed:** export a `SCF_CHART_SEED` with the main accounts used:
  - 411 Clients, 401 Fournisseurs
  - 4457 TVA collectée, 4456 TVA déductible
  - 700 Ventes, 600 Achats
  - 512 Banque, 53 Caisse
  - 445 Taxes (stamp duty)
  
  Every one carries ⚠ needs accountant verification.
- **Service:**
  - `ensureChart(ctx)` and `ensureJournals(ctx)`.
  - `postEntry(ctx, entry)`: validates Σdebit = Σcredit in code and rejects otherwise. Numbering is per journal. The entry is immutable once posted; reversal goes through `reverseEntry`.
  - Reports: trial balance, general ledger per account, partner balances, and a **G50 VAT summary draft** for a month (collected − deductible), marked ⚠.
- **events.ts:**
  - `invoicing.invoice.posted` → sale or purchase entry (411/700/4457, or 401/600/4456; refunds inverted).
  - `invoicing.payment.registered` → 512 or 53 against 411/401.
  - `pos.order.paid` → 53/700/4457.
  - All idempotent by source.
- **Pages:** chart of accounts, journals, entries list and detail, a manual entry form, and the reports pages.

## W5-F pos (ns `pos`, route `/pos`, order 55)
- **Tables:** `pos_sessions` (opened_by, opened_at, closed_at, opening_cash_cents, closing_cash_cents, state open/closed), `pos_orders` (session_id, number `POS-{YYYY}-`, partner_id nullable, totals, method cash/cib/edahabia, paid_at) and `pos_order_lines`.
- **Service:** open and close a session (expected cash = opening + cash sales), `createPaidOrder` (validates totals server-side, emits `pos.order.paid`), and a session report.
- **UI:** a full-screen touch-friendly sale screen at `/pos/session/[id]`:
  - product grid with search
  - cart with qty +/-
  - total
  - pay buttons (Cash / CIB / Edahabia)
  - printable ticket (80mm HTML)
  
  It's a client component, and it must be usable on a cheap Android phone. Plus a sessions list and a close dialog.

## W5-G hr (ns `hr`, route `/hr`, order 60)
- **Tables:** `departments`, `employees` (user_id nullable, partner_id nullable, first/last name, job_title, department_id, manager_id, hire_date, phone, email, nin nullable ⚠ personal data, active), `leave_types`, `leave_requests` (employee_id, type_id, from, to, days numeric, state draft/submitted/approved/refused) and `attendances` (employee_id, check_in, check_out).
- **Service:** CRUD; submit, approve and refuse leave (managers); check-in and check-out (one open attendance per employee); monthly attendance summary.
- **Pages:** employees, departments, leave requests (approve and refuse), attendance (a big check-in/out button for the current user's employee record).

## W5-H projects and helpdesk (ns `projects` and `helpdesk`; routes `/projects` order 61, `/helpdesk` order 62; two modules in one task)
- **projects:** `projects` (name, partner_id, manager_id, state active/done/archived), `project_stages` (per project), `project_tasks` (stage_id, assignee_id, priority, deadline, description) and `timesheets` (task_id, user_id, date, hours numeric). Pages: project list, task Kanban (use `src/ui/views/kanban`), task detail with chatter and timesheets.
- **helpdesk:** `helpdesk_teams`, `tickets` (number `TK-{YYYY}-`, partner_id, team_id, assignee_id, priority, stage new/in_progress/waiting/solved/closed, channel whatsapp/phone/email/walk_in, subject, description). Pages: ticket Kanban by stage, list, new and detail with chatter.

## W5-I website and shop (ns `website`, route `/website` for admin, public route `/[locale]/shop/[slug]/**`)
- **Tables:** `website_settings` (company_id unique, slug unique, enabled, title, about, phone_whatsapp, show_prices) and `web_orders` (number `WEB-{YYYY}-`, customer name, phone, wilaya, address, lines jsonb, total_cents, state new/confirmed/cancelled, sale_order_id nullable).
- **Public pages:**
  - shop home (published products: `products.active` and a `website_published` flag in website_settings' product list, or just all active products with price > 0)
  - product page
  - cart (localStorage, client)
  - checkout form with name, phone, wilaya and address, for cash on delivery
  - "Order on WhatsApp" link
- **Public service:** must **not** use withTenant. Use the owner connection, always filtering by the company_id resolved from the slug, and expose only the safe fields. Rate-limit checkout naively (max 5 orders per phone per hour).
- **Admin:** settings form, web orders list, and a "Convert to sales order" button. Since a direct call is forbidden, it creates the sale order by inserting through an action that calls a sales-free path: just mark it confirmed and show the customer data. The integrator wires the conversion later.

## W5-J marketing (ns `marketing`, route `/marketing`, order 70)
- **Tables:** `campaigns` (name, channel whatsapp/sms/email, message_fr, message_ar, segment jsonb (filters: customer/prospect/wilaya/has_overdue), state draft/ready/sent) and `campaign_recipients` (campaign_id, partner_id, phone, status pending/sent/failed, sent_at).
- **Service:** build recipients from the segment over partners (and over overdue installments via SQL on `installments`/`contracts` when has_overdue), with message personalisation `{name}` `{shop}`. Mark sent and track per-recipient progress.
- **UI:** campaign list, editor with preview, and a recipients page with one **WhatsApp link per recipient** (`whatsappLink` from `@/modules/credit_sales/service/reminders`) plus a "mark sent" toggle. No bulk-sending API; Meta rules prevent it.

## W5-K platform: custom fields, API keys, REST API, webhooks (ns `platform`, route `/settings/platform`, order 95)
- **Custom fields:** use the existing `custom_field_defs` table (read its schema in `src/core/db/schema`; if it doesn't exist, define `custom_field_defs` in your module schema: entity, key, label_fr, label_ar, label_en, type text/number/date/boolean/select, options jsonb, required, position). Settings UI to define fields for `contacts.partner`. A `<CustomFieldsEditor entity recordId>` component reads and writes the `partners.custom` jsonb. **Don't edit contacts files**; the integrator mounts it.
- **API keys:** `api_keys` (name, prefix, hash sha-256, scopes text[], last_used_at, revoked_at). The key is shown once. Header `Authorization: Bearer tav_…`.
- **REST:** `src/app/api/v1/[...path]/route.ts` with `GET /api/v1/contacts`, `GET/POST /api/v1/products`, `GET /api/v1/invoices` (read the tables via `withTenant` using the key's company and a system user, the company owner from memberships), pagination, and `GET /api/v1/openapi.json`.
- **Webhooks:** `webhooks` (url, events text[], secret, active) and `webhook_deliveries` (webhook_id, event_name, payload jsonb, status, attempts, last_error). `deliverEvent(row)`: HMAC-SHA256 signature header `X-Tavio-Signature`, called from the outbox drain. Export `handleOutboxRow(row)` from `src/modules/platform/outbox-handler.ts`; the integrator wires it into `/api/cron/outbox`.
- **Unit tests:** key hashing and verification, signature, and scope checks.

## W5-L automation and subscriptions, plus on-prem packaging
- **automation (ns `automation`, route `/settings/automation`):** `automation_rules` (name, trigger event name from the catalog, conditions jsonb (simple field equals/greater-than on the payload), action create_activity/post_note/webhook, action_config jsonb, active). Export `runAutomations(ctx, event)` from `src/modules/automation/engine.ts`; the integrator calls it after every emit. Settings UI to manage rules. Unit-test condition evaluation.
- **subscriptions (ns `subscriptions`, route `/settings/billing`):** global table `saas_plans` (no company_id: code, name, price_dzd_cents per user per month, max_users, modules text[]) and tenant table `company_subscriptions` (plan_id, seats, state trial/active/past_due/cancelled, trial_ends_at, current_period_end, payment_method ccp/transfer/cash). Export a `SAAS_PLAN_SEED` (Free with 1 user and core+contacts+credit_sales; Pro; Business). Billing page shows the current plan, seats, and manual payment instructions (CCP/transfer). Add `isModuleAllowed(plan, moduleId)` with a test.
- **On-prem:**
  - `Dockerfile`: multi-stage, `next build` standalone output (enable `output: 'standalone'` only when `TAVIO_STANDALONE=1`; you may edit next.config.ts for that line only).
  - `docker-compose.yml`: postgres:17, the app, `gotenberg/gotenberg:8` and `minio/minio`, with env wiring and a migration step.
  - `scripts/backup.sh`: pg_dump, gzip, then optional upload to S3/R2 with aws-cli env.
  - `docs/on-prem.md`.
  
  Don't build images, but validate with `docker compose config` only if docker exists; otherwise check the YAML.
