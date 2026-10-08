# Tavio Roadmap

Status: draft v1, 2026-10-08. Authoritative architecture: `docs/plan/ARCHITECTURE.md`. Where this file and ARCHITECTURE.md differ, ARCHITECTURE.md wins and this file must be fixed.

Items marked ⚠ are unverified legal, tax or technical claims. They need the named reviewer before the work they block is marked done.

Tavio is a fresh build. The old `installment-app` is not a code source. Its audit (`docs/research/00-existing-app-audit.md`) is only a list of credit-sales behaviours and gaps to check against.

## 0. Phase map

| Phase | Name | Depends on | In MVP |
|---|---|---|---|
| P0 | Foundation | none | yes |
| P1 | Core data (contacts, products, DZD, taxes, sequences, attachments, chatter, l10n_dz) | P0 | yes |
| P2 | Credit sales (`credit_sales`) | P0, P1 | yes |
| P3 | CRM (`crm`) | P0, P1, P2 (convert-to-contract) | yes |
| P4 | Sales and invoicing | P1, P2 (payments reuse), P5 optional for stock | no |
| P5 | Inventory and purchases | P1 | no |
| P6 | Accounting (SCF) | P4, P5 | no |
| P7 | POS, HR, project/helpdesk, website/eCommerce, marketing | P4, P5, P6 (per app) | no |
| P8 | Platform (custom fields, automation, API, billing, backups, on-prem packaging) | P0 to P4 at minimum | no |

**MVP = P0 + P1 + P2 + P3.** See section 7 for the launch checklist and section 8 for out-of-scope items.

## 1. Conventions used in this roadmap

- **Module ids** match ARCHITECTURE.md section 5 (`contacts`, `products`, `l10n_dz`, `credit_sales`, `crm`, and so on).
- **Definition of done (DoD)** items are testable. Each one maps to an automated test, a scripted check, or a recorded manual check with a date. A phase is done only when every item is ticked.
- **Contract freeze.** Shared contracts are the core db client and schema conventions, `withTenant()`, auth, tenancy, perms, module registry, `bus.emit`/outbox, the adapter interfaces, the UI kit props, and the i18n key scheme. Changing them needs the lead's approval (ARCHITECTURE section 4 and the handoff brief, section 5).
- **Money** is stored as `bigint` centimes (`amount_cents`). Quantities are `numeric(14,3)`. No floats anywhere in money code.

---

## 2. P0: Foundation

**Goal.** A running, tested, multi-tenant skeleton that every later module plugs into. It has tenancy, auth, roles, the module registry, the money and sequence primitives, the audit log, the event bus, the UI kit and i18n with RTL, and CI. It has no business features.

**Modules (folders).**
- `src/core/db/`: `client.ts`, `tx.ts` (`withTenant`), `schema/` (core tables), migrations setup in `drizzle/`
- `src/core/auth/`: better-auth setup, session, `requireUser()`
- `src/core/tenancy/`: companies, memberships, company switcher
- `src/core/perms/`: permission registry, `can()`, `requirePerm()`
- `src/core/modules/`: `defineModule()`, `registry.generated.ts`, enabled-modules check
- `src/core/events/`: typed in-transaction bus, `outbox` table and drain
- `src/core/audit/`: audit log writer
- `src/core/sequences/`: gap-free next number
- `src/core/money/`: cents helpers, DZD formatting, rounding (rule is configurable, see P1)
- `src/core/adapters/`: `Storage`, `PdfRenderer`, `JobRunner`, `Mailer`, `AiProvider`, with an in-memory impl and a cloud impl for each
- `src/core/i18n/`: next-intl config, RTL helpers
- `src/ui/`: design-system kit (shadcn-based), `DataList`, `RecordForm`, `Kanban` shells, `ChatterPanel` shell, `SearchBar`, app shell and menu filtering
- Test harness, CI, dev `docker-compose.test.yml` and a local `docker compose` for postgres, app, gotenberg and minio

**Features.**
- Sign up, log in, log out, email invite, password reset (better-auth, same in cloud and on-prem)
- One user can belong to many companies (`memberships`), with a company switcher in the header (fixes the old one-shop limit)
- Company creation with name, phone, address (the fields the old app used on contracts and receipts)
- Roles per company: `owner`, `admin`, `manager`, `staff`. Each role is a set of permission strings. Menus are filtered by `can()`
- `requirePerm()` in every server action. Default is deny
- Record rules as service-level filters, with one example rule ("staff see only their own records") wired and tested
- Module registry: `defineModule()`, generated static registry, dependency check at build, enable and disable per company through `company_modules`
- `withTenant()` sets `app.company_id` with `SET LOCAL` at the start of each transaction. The app connects as the non-owner role `tavio_app`
- Posted-row protection trigger (a reusable pattern: UPDATE and DELETE are rejected when `state = 'posted'`)
- Gap-free sequences per (company, code), locked inside the same transaction
- Audit log written in the same transaction as each mutation
- Event bus: synchronous handlers in the same transaction, plus an `outbox` table drained by a cron-driven job (cloud) or a polling node worker (on-prem)
- Adapter interfaces with in-memory implementations for tests
- i18n with `fr` default, `ar` (`dir="rtl"`), `en`. Only Tailwind logical properties are allowed (lint rule)
- Money helpers: centimes arithmetic, DZD formatting with `Intl.NumberFormat('fr-DZ' | 'ar-DZ')`

**Depends on.** None.

**Definition of done.**
- [ ] `typecheck`, lint, unit, integration, build run green in GitHub Actions on a clean clone (order: typecheck, lint, unit, migrate fresh Postgres 17, integration, build)
- [ ] A fresh empty Postgres 17 migrates from the ordered `drizzle/` folder with no errors, and file names carry the module prefix
- [ ] Tenant isolation test for every core table: a user of company A cannot read or write company B rows, tested as the `tavio_app` role
- [ ] `withTenant()` is fail-closed: a query run without `app.company_id` set returns zero rows, not all rows
- [ ] Posted-row trigger test: UPDATE and DELETE on a posted row are rejected; a reversal path is the only correction route
- [ ] Sequence test: 1,000 concurrent `nextNumber()` calls give no gaps and no duplicates
- [ ] Rollback test: when a mutation fails, both the data change and its audit row are rolled back
- [ ] `requirePerm()` test: every permission string has an allow case and a deny case; missing permission denies
- [ ] Module registry test: missing dependency fails the build; a cycle fails the build; enabling a module enables its dependencies; disabling is refused while an enabled module depends on it
- [ ] A user in two companies sees both and can switch between them; switching changes the tenant used in queries
- [ ] Locale switch: `ar` sets `dir="rtl"`; the lint rule rejects physical CSS properties (`ml-`, `pr-`, `left-` and so on)
- [ ] Latency probe task P00-T18 is run from at least 3 Algerian lines (Djezzy, Mobilis, ADSL) and results are saved in `docs/plan/` ⚠
- [ ] Local `docker compose` boots postgres, app, gotenberg and minio, and login works against it (customer-ready packaging is P8)
- [ ] Restore smoke test: `pg_dump` from the test database restores into a fresh Postgres 15+ and the smoke script passes
- [ ] Shared contracts listed in section 1 are frozen and recorded in the repo with their version

**Main risks.**
- ⚠ better-auth maturity and its behaviour under OpenNext on Workers
- ⚠ Next 16 plus OpenNext edge cases. Spike this first, before the shell is built
- Tenant leaks from a forgotten `withTenant()`. Mitigated by fail-closed behaviour and tests for every table
- Contract churn: if the freeze slips, parallel agents conflict. Mitigated by the freeze gate
- Scope creep into business features before the foundation is proven

### 2a. P0 wave plan (after the contract freeze)

The contract freeze is sequential. One owner (the lead or one agent) writes the core db client, schema conventions, `withTenant()`, auth, tenancy, perms, module registry, outbox contract, adapter interfaces, UI kit prop types, and the i18n key scheme. Nothing else starts before that gate.

- **Wave A (parallel, after freeze).** Disjoint files, no shared edits.
  - Sequences implementation and its concurrency test
  - Money helpers and their unit tests (rounding rule injected, not hard-coded)
  - Audit log writer and its rollback test
  - Event bus and outbox drain (in-memory and cron-driven)
  - Adapter in-memory impls (Storage, PdfRenderer, JobRunner, Mailer)
  - UI kit components: `DataList`, `RecordForm`, `Kanban`, `ChatterPanel`, `SearchBar`, each against its prop types
  - i18n message skeletons (fr, ar, en) and the logical-properties lint rule
  - CI workflow and `docker-compose.test.yml`
  - Latency probe script (P00-T18)
- **Wave B (parallel, after Wave A merges).**
  - Cloud adapter impls: R2 storage, Browser Rendering PDF, Queues job runner
  - On-prem adapter impls: MinIO, Gotenberg, node outbox poller
  - Menu filtering by `can()` and the app shell
  - Company creation, invites and company switcher UI
  - Playwright smoke harness (log in, then create a company)
  - Backup script (nightly `pg_dump` to an R2 bucket in another account) and restore script
- **Wave C (sequential integration).** The lead or one reviewer runs the full suite, fixes seams, runs the restore test and the on-prem smoke test, and freezes P0 as done.

---

## 3. P1: Core data

**Goal.** The shared records every business module uses: one contact model, products, DZD and Algerian taxes as data, sequences exposed to documents, attachments, and chatter. The Algerian configuration lives in `l10n_dz` as dated data, not in code.

**Modules.** `contacts`, `products`, `taxes` (inside `l10n_dz` and `core`), `attachments`, `chatter` (core), `l10n_dz` (data).

**Features.**
- **Contacts (partners).** One table with roles: customer, supplier, prospect, guarantor. Fields: name, phone (E.164, `+213` default), email, wilaya and commune, address, NIF, NIS, RC, AI (the AI field is optional and marked ⚠), notes. Duplicate check on phone and NIF. Merge with event `contacts.partner.merged`
- **Products.** Name (fr/ar/en), SKU, unit of measure, sale price in centimes, tax rate reference, active flag, stock counter stub (real stock is P5)
- **Currency.** DZD only, 2 decimals, formatted with `fr-DZ` and `ar-DZ`. Multi-currency is out of scope
- **Taxes.** VAT rates as dated rows in `l10n_dz` (19% normal, 9% reduced). Rate lookup by document date. Stamp-duty tiers as dated rows
- **Units.** Unit table (piece, kg, m, and so on), per product
- **Sequences exposed.** Document numbering settings per company and code (for example `CONTRACT`, `RECEIPT`), prefix and padding
- **Attachments.** Private files in R2 (cloud) or MinIO (on-prem) through the `Storage` adapter. Signed URLs with short expiry. Uploads are limited in size and type
- **Chatter.** `messages`, `activities`, `followers` on any record through `(entity, record_id)`. Tracked fields write system messages
- **l10n_dz data.** Wilayas (58 by Law 19-12, ⚠ to verify), identifier field definitions (NIF, NIS, RC, AI), invoice mention list (empty until P4 verification), dated tax and stamp tables, SCF chart placeholder (filled in P6)

**Depends on.** P0.

**Definition of done.**
- [ ] Contact CRUD for each role; a contact can hold several roles at once
- [ ] Phone normalization test: `0550 12 34 56`, `+213550123456` and `00213550123456` store the same E.164 value
- [ ] Duplicate detection test on phone and NIF; merge moves all chatter, attachments and links to the surviving contact and emits `contacts.partner.merged`
- [ ] Money test: a product price of 1234.50 DZD is stored as `123450` centimes and displays `1 234,50 DA` in `fr-DZ` and in `ar-DZ`
- [ ] Tax lookup test: a document dated before and after a rate change picks the right rate from `l10n_dz`
- [ ] `l10n_dz` data load test: every dated row has a `verified_by` and `verified_on` field, and the build fails when a row is unverified and the flag `strict_l10n` is on ⚠
- [ ] Attachment test: a file of another company is not reachable through its signed URL; expired URLs are refused
- [ ] Chatter test: a tracked field change writes exactly one system message, in the same transaction
- [ ] Tenant isolation test for every P1 table
- [ ] Contacts and products list views work with server-side pagination and search at 10,000 rows, with the first page returned in under 300 ms from the Paris database (measured in the test environment)

**Main risks.**
- ⚠ Tax and stamp values are unverified (see MVP checklist, section 7)
- Phone normalization differences between Algerian operators and formats
- Mixing currency and rounding rules in the UI instead of in `core/money`
- Over-modelling contacts before the first pilot. Keep the first version to the fields listed

---

## 4. P2: Credit sales (`credit_sales`)

**Goal.** The first sellable module. A shop sells goods on instalments, tracks each instalment and payment, issues receipts and contract PDFs, and follows up on late payers. Behaviour is taken from the old app's audit as a checklist. No code is ported. The rules below are re-derived and tested from scratch.

**Modules.** `credit_sales` (`contracts`, `installments`, `payments`, `receipts`), `customer_credit` (guarantor, employer, income, risk), `reminders`. Depends on `contacts`, `products`.

**Features.**
- **Customer credit profile.** National ID number, optional ID photo (encrypted at rest in R2, optional by design per ARCHITECTURE section 2), employer, monthly salary, guarantor (a contact with role guarantor), notes. Rule-based client score (on-time history, open balance, late count) with the rule written in the entity metadata, not in the UI
- **Sale (contract).** Pick a customer and products, set a markup (percent) and a down payment, choose number of instalments and frequency. The MVP frequency is monthly only, weekly and custom come later
- **Schedule.** Financed amount = total minus down payment. Each instalment is the floor of financed divided by n, and the last instalment takes the remainder. Due dates step forward monthly and clamp to the end of the month. The schedule is computed server-side and stored, not recalculated on read. Schedules with 1 instalment and with zero financed amount are handled
- **Contract lifecycle.** `draft`, `active`, `completed`, `cancelled`. Cancellation is a reversal, not a delete: it writes a cancellation record and reverses any stock decrement. Posted contracts are protected by the posted-row trigger
- **Payments.** Cash, card, bank transfer, CCP (recorded as a method, no bank integration). Partial payments against one instalment. A payment cannot exceed the open balance. Each payment writes a receipt number from the sequence `RECEIPT`
- **Instalment status.** `upcoming`, `partial`, `paid`, `late`. The `late` status is written by a daily job (cron through the outbox), not only derived on read. The audit found that the old app never updated it. Overdue lists read the stored status and the Africa/Algiers date
- **Receipts and contract PDFs.** HTML templates rendered by `PdfRenderer` (Browser Rendering in cloud, Gotenberg on-prem). French and Arabic templates. Receipts show the company name, phone, address and NIF when set. Fiscal mentions and stamp duty are ⚠ and come from `l10n_dz` only
- **Reminders.** Reminder list for due and late instalments. Actions are a call link (`tel:`) and a WhatsApp link (`wa.me`) with a message template in fr, ar and Darija. No automatic sending in the MVP
- **Dashboard.** Counts of active contracts, amounts due this week, late amount, cash collected this month. All numbers computed in the service layer with tests
- **Overdue and upcoming lists** with filters in the URL and server-side pagination

**Depends on.** P0, P1 (contacts, products, sequences, attachments, chatter, l10n_dz).

**Definition of done.**
- [ ] Schedule test table: 1 instalment; 12 instalments with a remainder; a 31 January start with monthly clamping to 28 or 29 February; zero financed amount; large amounts near the bigint limit. All in Vitest with fixed expected centimes
- [ ] Sum test: the sum of instalments equals financed amount in every case, to the centime
- [ ] Partial payment test: two partial payments on one instalment give `partial` then `paid`, and the receipt numbers are consecutive
- [ ] Over-payment test: a payment above open balance is rejected and nothing is written
- [ ] Concurrency test: two parallel `recordPayment` calls on the same instalment cannot pay more than the balance (row lock with `SELECT ... FOR UPDATE`)
- [ ] Receipt numbering test: 500 concurrent receipts for one company give no gaps and no duplicates
- [ ] Cancel test: a cancelled contract keeps its rows; a reversal record exists; no row is deleted (trigger test)
- [ ] Late job test: an instalment past due in Africa/Algiers time is set to `late` once, idempotently; re-running the job changes nothing
- [ ] Reminder link test: `tel:` and `wa.me` links encode the number in E.164 and the message in the right language
- [ ] PDF test: the French and Arabic receipts render, the Arabic one is RTL, and the numbers are shown as expected by `ar-DZ`. Manual visual check recorded
- [ ] Tenant isolation for every P2 table, plus the encrypted ID photo is not reachable from another company
- [ ] Dashboard numbers match a hand-computed fixture
- [ ] Low-end phone check: contract list and payment entry usable at 375 px width with no horizontal scroll

**Main risks.**
- ⚠ Consumer credit law (Law 09-03) and what a contract must contain. No rule for effective annual rate, withdrawal or early repayment was found in research. Needs lawyer verification before pilot
- ⚠ Markup and late penalties: whether any late fee is allowed. The MVP has no automatic penalty
- ⚠ Law 18-07 for ID photos and guarantor data (minimise, consent text, retention)
- Rounding: the rule that divides financed amounts must be confirmed by an accountant. The old rule (floor, remainder on last) is a candidate, not a verified rule
- Stock: the MVP keeps a simple counter behind an interface that P5 replaces
- PDF cost and Arabic rendering in Browser Rendering ⚠

---

## 5. P3: CRM (`crm`)

**Goal.** Shops track prospects and follow-ups before they become credit customers. The pipeline turns a lead into a contact and, when agreed, a credit contract. This is the second half of the MVP.

**Modules.** `crm` (`leads`, `stages`, `lost_reasons`, `reports`), `reminders` (shared with P2), `ai_assist` (optional, behind a flag).

**Features.**
- **Leads.** Name, phone, wilaya, interest (product or category), source (walk-in, phone, WhatsApp, referral), expected amount, assignee, notes
- **Pipeline (kanban).** Stages (configurable per company, with default stages: new, contacted, visit, offer, won, lost). Drag between stages. Each stage has a probability used for weighted value
- **Activities.** Call, WhatsApp, visit, follow-up with a due date and assignee. Scheduled reminders for due activities (through the outbox and cron), one reminder per activity
- **Convert.** Convert a lead to a contact (one row, linked) and optionally open a P2 credit contract draft. Conversion is one transaction
- **Lost reasons.** Required when a lead moves to lost
- **Team and record rules.** `staff` see only their own leads by default. `manager` and `admin` see all. Assignment changes are audited
- **Reports.** Leads by stage, weighted pipeline value, win rate for the period, activities overdue, source breakdown. All computed in services with fixtures
- **Reminder hooks.** WhatsApp and SMS through the `Mailer`-style messaging adapter. MVP uses links only. Automatic sending is behind a flag and off by default
- **AI reminder drafts (optional, ⚠).** Drafts of follow-up messages in fr, ar and Darija through `AiProvider`. A human sends them. AI never changes money records
- **CSV import of leads** with a preview step and error report (optional if time allows)

**Depends on.** P0, P1 (contacts, chatter), P2 (contract draft on convert).

**Definition of done.**
- [ ] Stage move test: a drag from one stage to another changes stage in one transaction, writes an audit row and an event `crm.lead.stage_changed`
- [ ] Lost test: moving to lost without a reason is refused
- [ ] Record rule test: a `staff` user cannot read or move another user's lead, through UI and through the API action
- [ ] Convert test: converting a lead creates exactly one contact and links the lead; converting twice is refused; if a contract draft is requested and fails, nothing is kept
- [ ] Reminder test: a due activity produces one reminder through the outbox, even if the job runs twice
- [ ] Report fixture test: weighted value, win rate and overdue counts match a hand-computed fixture
- [ ] Kanban usability: stage move works on a 375 px phone with touch, and the list view is the default on small screens
- [ ] Tenant isolation for every P3 table
- [ ] AI drafts: when the flag is off, no call to `AiProvider` is made (test). When on, the draft is stored as unsent text and is never sent automatically (test)

**Main risks.**
- Pipeline UI on cheap phones and slow connections. Mitigation: list-first on small screens, optimistic UI with rollback
- Duplicate contacts created by conversion. Mitigation: duplicate check from P1 runs first
- ⚠ WhatsApp and SMS provider terms and cost. MVP uses links only
- Over-building reports before pilot feedback. Keep to the five reports listed
- ⚠ AI draft quality in Darija. Treat as a drafting aid only

---

## 6. P4 to P8 (short)

**P4: Sales and invoicing.** Modules `sales`, `invoicing`. Depends on P1, P2, P5 (optional stock).
- Quotation to order to invoice; gap-free numbering; VAT per line (19% and 9% from `l10n_dz`); discounts; totals in centimes
- Invoice PDF with mandatory mentions (⚠ not yet verified); credit notes as reversal documents; stamp duty where applicable (⚠)
- DoD: numbering concurrency test; posted invoices immutable; VAT rounding matches the accountant-confirmed rule; tenant isolation for every table
- Risks: ⚠ mandatory mentions, ⚠ rounding, ⚠ future CTC e-invoicing (not in first version)

**P5: Inventory and purchases.** Modules `inventory`, `purchases`. Depends on P1.
- Warehouses; append-only stock moves, stock on hand derived from moves; replaces the P2 counter behind the same interface; reorder alerts
- RFQs, purchase orders, goods receipt (partial quantities), vendor bills (feed P6), supplier price lists
- DoD: stock equals sum of moves in every test; cancellation is a reversing move; partial receipt keeps order balance correct
- Risks: quantity precision across units; migrating the P2 counter without mismatch

**P6: Accounting (SCF).** Modules `accounting`, `l10n_dz` (SCF data). Depends on P4, P5.
- SCF chart as data (⚠ full class 1 to 9 nomenclature unverified); journals; posted entries immutable; reversals; automatic entries from invoices, bills and payments
- Monthly VAT summary for G50 (⚠ rules secondary-source only); timbre tracking (⚠); bank reconciliation by CSV; statements in SCF layout (⚠)
- DoD: debits equal credits enforced by the database; posted entries cannot change; G50 and statement fixtures approved by an accountant
- Risks: ⚠ SCF nomenclature, G50 and timbre rules; accountant time; ⚠ retention period

**P7: POS, HR, project and helpdesk, website and eCommerce, marketing.** Depends on P4 to P6 per app. Each app is planned after pilot feedback. POS needs offline tolerance. HR needs labour-law review (⚠). eCommerce needs online payment through SATIM (⚠).

**P8: Platform.** Depends on P0 to P4 at minimum.
- Custom fields (`custom jsonb` plus `custom_field_defs`); automation rules as data; public REST/OpenAPI with per-company API keys; signed webhooks from the outbox
- SaaS billing in DZD (⚠ payment methods); customer-visible backup export; on-prem packaging, install guide and licence keys; reseller tools
- DoD: custom field changes audited and tenant-isolated; key scope test; webhook retry test; clean-VM on-prem install passes smoke suite; restore drill within the last quarter
- Risks: scope size (Odoo took 15+ years); API stability promises; on-prem support load; ⚠ billing provider availability

## 7. MVP launch checklist

Each item needs a named owner and a dated sign-off. The launch does not happen until every item is ticked.

**Accountant verification (Algerian expert-comptable).**
- [ ] VAT: normal 19% and reduced 9% rates confirmed, and the scope of the 9% rate for services and goods used in the MVP (LF 2026 changes) ⚠
- [ ] Stamp duty (timbre fiscal) tiers confirmed, including whether they apply to receipts, and how the rule applies (whole amount versus brackets) ⚠
- [ ] Mandatory invoice and receipt mentions confirmed for the receipt and contract PDFs ⚠
- [ ] Identifier use confirmed: NIF, NIS, RC, and whether "AI" appears on documents ⚠
- [ ] Rounding rule for instalments and receipts confirmed and written into `l10n_dz` and `core/money` ⚠
- [ ] Record retention period decided (6 or 10 years) and the backup and PITR plan matched to it ⚠
- [ ] Cash rules that affect receipts (cash threshold, cash ban for listed sectors) confirmed ⚠

**Lawyer review.**
- [ ] Law 18-07 as amended by Law 25-11: legal basis, consent text, data minimisation (ID photo optional and encrypted), retention, subject rights
- [ ] Transfers abroad: whether Supabase (Paris) and Cloudflare processing need ANPDP authorization, and the mitigation chosen (ARCHITECTURE section 3, risk 2) ⚠
- [ ] Data processing terms with each vendor, and a data processing agreement template for pilot shops
- [ ] Law 09-03 (consumer protection) and the required content of an instalment contract. Effective rate and early repayment rules
- [ ] Guarantor data handling and consent
- [ ] Penalty and late-fee wording (the MVP has no automatic penalty; confirm)

**Latency test (P00-T18).**
- [ ] Ping and page-load tests from Djezzy, Mobilis and ADSL, at different times of day, against the Paris database and the Workers edge
- [ ] Proposed targets for sign-off: median screen action under 1.5 s on 4G; p95 server time under 300 ms from Paris; first page of any list under 2 s on a 3G-class connection. Targets are proposed, not verified
- [ ] Decision gate: if targets fail, decide between Smart Placement tuning, Hyperdrive, caching, or a different region. Record the decision in ARCHITECTURE

**Backups and restore test.**
- [ ] Nightly `pg_dump` to an R2 bucket in a separate account, verified by a size and checksum check
- [ ] PITR enabled on Supabase, and the add-on cost confirmed ⚠
- [ ] Restore test: restore the latest dump into a fresh Postgres 15+ and run the smoke suite (log in, create contact, contract, payment). Pass recorded with date
- [ ] RPO and RTO proposed and signed off (proposal: RPO 24 hours, RTO 4 hours)
- [ ] Quarterly restore drill scheduled

**French and Arabic UI review.**
- [ ] Native French review of all MVP strings (no literal English left)
- [ ] Native Arabic review, with Darija wording checked for reminder templates
- [ ] RTL layout check of every MVP screen at 375 px and 1280 px, with no physical CSS properties
- [ ] Receipt and contract PDFs checked in French and Arabic
- [ ] Numbers, dates and DZD formatting checked in `fr-DZ` and `ar-DZ`, including Western and Eastern Arabic digit choice

**Pilot with 3 Algerian shops.**
- [ ] Three shops chosen with active credit sales, different sectors, and different wilayas. Selection criteria written down
- [ ] Signed pilot agreement with data processing terms from the lawyer review
- [ ] Four-week pilot with a named support contact and a daily check-in
- [ ] Success measures: contracts created without help, payments recorded without help, time to record a payment, number of bugs by severity, reminders used
- [ ] Data export on request, tested for each pilot shop
- [ ] Go or no-go review at the end, with notes saved in `docs/plan/`

**Security (cross-cutting).**
- [ ] Service-role key never shipped to the client (checked in build output)
- [ ] RLS tenant tests passing for every table, and the app role is non-owner
- [ ] SECURITY DEFINER functions reviewed (search_path set, grants minimal)
- [ ] Secrets stored only in platform secrets (not in the repo)

---

## 8. Out of scope for MVP

- Invoicing and quotations (P4). Credit contracts and receipts are the only sales documents in the MVP
- Stock on warehouses and purchases (P5). The contract stock counter is a stub
- Accounting, SCF chart, G50 filing, bank reconciliation (P6)
- POS, HR, projects, helpdesk, website and eCommerce, marketing campaigns (P7)
- Custom fields, automation rules, public API, webhooks, API keys (P8)
- SaaS billing and subscriptions for Tavio itself (P8). The pilot is free
- Online payments by CIB, Edahabia or any gateway. Payments are recorded by hand (cash, card terminal, transfer, CCP)
- Automatic WhatsApp or SMS sending. Only click-to-send links
- E-invoicing (no binding framework yet ⚠)
- Native mobile apps. The MVP is a PWA-capable responsive web app
- Multi-currency, weekly or custom instalment frequencies
- AI features beyond optional, flagged reminder drafts
- Customer-ready on-premise packaging and support (P8). Only the dev compose setup is in P0
- Hosting in Algeria (a later tier, depends on Law 18-07 review)
- Multi-language beyond fr, ar and en

---

