# Wave 4: MVP features (contacts, products, taxes, chatter, credit sales, CRM, dashboard)

Every task:
- **Read first:** `AGENTS.md` (Next 16; see `node_modules/next/dist/docs/`), `docs/plan/CONVENTIONS.md`, your module's `schema.ts`, `entities.ts` and `manifest.ts`, `src/core/entities/types.ts`, and the building blocks you'll use:
  - `src/core/actions/define-action.ts`
  - `src/core/db/tenant.ts`
  - `src/core/sequences`, `src/core/audit`, `src/core/events`
  - `src/ui/views/*` (DataList, RecordForm, Kanban, SearchBar, Pagination, format)
  - `src/ui/primitives/*`
  - an existing page such as `src/app/[locale]/(app)/settings/page.tsx` for the layout style
- **Edit only the files you own.** Stubs carry frozen signatures: replace the bodies only.
- **Services** take `ctx: Ctx` and use only `ctx.tx`; RLS applies.
  - Every mutation calls `audit(ctx, …)`.
  - Money is bigint cents, using `@/core/money`.
  - Return a `Result`, and never throw for expected errors.
- **Pages** live under `src/app/[locale]/(app)/…`. They're server components that build a ctx with a page helper (see below), call services, and render views.
  - Server actions wrap services with `defineAction` and `toFormAction`.
  - Permission strings come from the module manifest.
- **Page ctx helper:** `src/core/actions/page-ctx.ts` (owned by W4-M; until it lands, use its signature): `withPageCtx<T>(fn: (ctx: Ctx) => Promise<T>): Promise<T>`. It resolves the session, active company and tenant, redirecting to login or onboarding when needed. If the file is missing in your worktree, create a local copy with that signature, implemented on top of `requireUser`, `getActiveCompanyId`, `listMyCompanies`, `loadTenantArgs` and `withTenant`. **Don't commit that copy.**
- **i18n:** add keys only to your module's namespace (`messages/{fr,ar,en}/<ns>.json`), in all 3 languages, merging with the existing keys.
- **Verification:** `pnpm typecheck && pnpm lint && pnpm test`, plus `pnpm test:int` for your `*.int.test.ts`. Integration tests create their own company and user rows with random uuids through the owner connection, run the services with `withTenant`, and clean up when possible.
- **UI must work at 360px width and in Arabic RTL.**

---
## W4-A Contacts
**Owns:** `src/modules/contacts/service/*`, `src/modules/contacts/actions.ts`, `src/app/[locale]/(app)/contacts/**`, `messages/*/contacts.json`, `src/modules/contacts/__tests__/*`
- **Service:**
  - `listPartners(ctx, q: ListQuery)`: search over name, phone and NIF; filters from the entity.
  - `getPartner`, `createPartner` and `updatePartner` (zod schema `partnerInput` exported from the service).
  - `archivePartner`: active = false.
  - `partnerOptions(ctx, search?)`: max 50 `{value, label}`, for selects in other modules.
- **Pages:**
  - `/contacts`: DataList, SearchBar and a "new" button.
  - `/contacts/new`: RecordForm.
  - `/contacts/[id]`: header, key info, an edit form in a tab, `<ScoreBadge partnerId>` from `@/modules/credit_sales/ui/score-badge`, and `<Chatter entity="contacts.partner" recordId>`.
- **Integration test:** create, list with search, update, archive, and isolation from another company.

## W4-B Products
**Owns:** `src/modules/products/service/*`, `src/modules/products/actions.ts`, `src/app/[locale]/(app)/products/**`, `messages/*/products.json`, `src/modules/products/__tests__/*`
- **Service:**
  - `listProducts`, `getProduct`, `createProduct` and `updateProduct` (price as a DZD string, parsed with parseDzd).
  - `archiveProduct`.
  - `productOptions(ctx, search?)`: label includes the price.
  - `listCategories` / `createCategory`.
  - `uomOptions(ctx)`: from the global uoms.
- **Pages:** `/products` (list), `/products/new` and `/products/[id]` (edit), plus an inline "add category" on the form page.
- **Integration test:** create, update and list.

## W4-C Taxes settings and global seeds
**Owns:** `src/modules/l10n_dz/service/*`, `src/modules/l10n_dz/actions.ts`, `src/app/[locale]/(app)/settings/taxes/**`, `scripts/seed-global.ts`, `messages/*/l10n.json`, `src/modules/l10n_dz/__tests__/*`; add a `db:seed` script to package.json (only that line).
- `scripts/seed-global.ts` loads env via `loadDevEnv()`. It upserts `UOM_SEED`, `CURRENCY_SEED` and the global `ACTIVITY_TYPE_SEED` (company_id null) with `on conflict do nothing`, and is idempotent. Run it once against the dev DB.
- **Service:** `listTaxes`, `createTax`, `updateTax`, `archiveTax`, `loadAlgerianDefaults(ctx)` (inserts DZ_TAX_DEFAULTS if missing; idempotent) and `taxOptions(ctx)`.
- **Page:** `/settings/taxes` lists taxes, has a "load Algerian defaults" button, and a create form. Show a visible ⚠ note: "Rates must be verified by your accountant."
- **Integration test:** loadAlgerianDefaults run twice leaves 2 VAT taxes.

## W4-D Chatter
**Owns:** `src/modules/chatter/service/*`, `src/modules/chatter/ui/*`, `src/modules/chatter/actions.ts`, `messages/*/chatter.json`, `src/modules/chatter/__tests__/*`
- Implement the stub service. Also add `listThread(ctx, entity, recordId)` (messages and activities merged, newest first) and `myOpenActivities(ctx, limit)`.
- `postMessage` with kind 'system' is for other modules (for example "Contract activated").
- `Chatter` server component:
  - It loads the thread and renders a composer (client) with "Send message" and "Log note" tabs.
  - A "Schedule activity" form has type, summary, due date and assignee (default me).
  - Open activities get a "Mark done" button, and overdue ones show in red.
  - On mobile it's a full-width section at the bottom.
- `MyActivities` is a list for the dashboard, with links built from entity to path (`contacts.partner` → `/contacts/{id}`, `credit_sales.contract` → `/credit/contracts/{id}`, `crm.lead` → `/crm/{id}`).
- **Integration test:** post, schedule, ensure (idempotent), complete and thread order.

## W4-E Schedule and contracts service
**Owns:** `src/modules/credit_sales/service/schedule.ts`, `src/modules/credit_sales/service/contracts.ts`, `src/modules/credit_sales/__tests__/schedule.test.ts`, `src/modules/credit_sales/__tests__/contracts.int.test.ts`
- `buildSchedule`, with exhaustive unit tests:
  - Jan 31 monthly gives Feb 28/29 and then Mar 31. Clamping is applied against the original day.
  - The remainder goes on the last line.
  - n = 1.
  - Weekly steps.
- `createDraftContract`:
  - Validate the input: lines ≥ 1, count 1..120, down payment ≤ total.
  - Compute each line total as qty × unit price (round half up), the cash price as the sum of lines, and `markupCents = applyRate(cashPrice − downPayment, markupRate)`.
  - Financed amount = cash price − down payment + markup. The total price is per the DATA_MODEL columns.
  - Insert the contract (state draft) and its lines, audit, and post a chatter system message.
- `updateDraftContract`: only while in draft; replaces the lines.
- `activateContract`:
  - Only from draft.
  - Number with `nextNumber(ctx,'credit_sales.contract',{prefix:'CR-{YYYY}-'})`.
  - Insert the installments from buildSchedule, set state active and activated_at, audit, and `emit(ctx,{name:'credit_sales.contract.activated',…})`.
- `cancelContract`: only active or draft, and only when no payments have been made unless the reason starts with "force:". Sets state cancelled. Audit.
- `getContract`: derived installment status (paid, partial, late, upcoming as in DATA_MODEL), plus totals.
- `listContracts`: the listed row fields; search on number and partner name; filter by state.
- **Integration test:** the full draft → activate flow (numbering CR-2026-00001, installment sum = financed), cancel rules, and isolation.

## W4-F Payments service
**Owns:** `src/modules/credit_sales/service/payments.ts`, `src/modules/credit_sales/__tests__/payments.int.test.ts`
- `recordPayment`:
  - The contract must be active.
  - The amount must be > 0 and ≤ remaining, else VALIDATION 'OVERPAYMENT'.
  - Lock the contract's installments with `for update`.
  - Insert the payment, then allocate oldest unpaid first (payment_allocations, and update installments.paid_cents).
  - Create a receipt numbered `nextNumber(ctx,'credit_sales.receipt',{prefix:'RC-{YYYY}-'})`.
  - If everything is paid, set the contract to completed.
  - Audit, and emit `credit_sales.payment.recorded` with `{ contractId, partnerId, paymentId, amountCents: string }`.
  - A down payment (isDownPayment) is recorded with no allocation to installments, and is allowed only once per contract. Read the DATA_MODEL notes.
- `listOverdue` and `listDueSoon(days)`: installments with paid < amount, joined with contract and partner, using Africa/Algiers dates.
- `listPayments`.
- **Integration tests:**
  - A partial payment spreads over installments correctly.
  - Receipt numbers have no gaps.
  - Overpayment is rejected.
  - The contract completes when everything is paid.
  - Overdue detection, using a backdated start date.

## W4-G Credit contracts UI
**Owns:** `src/app/[locale]/(app)/credit/contracts/**`, `src/modules/credit_sales/actions/contracts.ts`, `src/modules/credit_sales/ui/contract-form.tsx`, `src/modules/credit_sales/ui/schedule-preview.tsx`, `src/modules/credit_sales/ui/installments-table.tsx`, and `messages/*/credit.json` (**only** this task edits credit.json in Wave 4; it must also add every key listed under W4-H, W4-I, W4-J and W4-N below)
- `/credit/contracts` has a DataList, a filter by state and a "new" button.
- `/credit/contracts/new` is a client form:
  - The partner comes from a select (partnerOptions loaded server-side), with a link to create one.
  - Lines: product select (fills the unit price), description, qty, price, add/remove.
  - Down payment, markup %, number of installments, frequency and first due date.
  - A **live schedule preview** using `buildSchedule` client-side, plus totals.
  - Saving creates a draft, then redirects to the detail page.
- `/credit/contracts/[id]`:
  - Header with number, state badge and partner link (with ScoreBadge).
  - Totals cards: financed, paid, remaining, late.
  - Installments table, with derived statuses colored.
  - Payments list, with receipt links to `/credit/receipts/{id}`.
  - Actions: Activate (draft), Cancel with a reason (dialog), `<RecordPaymentButton>` (active), and a "Print contract" link to `/credit/contracts/{id}/print`.
  - `<Chatter entity="credit_sales.contract">`.
- Keys required by other tasks, to add to credit.json:
  - `credit.payment.*`: record, amount, method, reference, down_payment, success, overpayment
  - `credit.methods.{cash,ccp,transfer,cib,edahabia,cheque}`
  - `credit.overdue.*`: title, days_late, call, whatsapp, empty
  - `credit.receipt.*`: title, number, received_from, amount, method, date, signature, print, download_pdf
  - `credit.print.*`: contract_title, seller, buyer, schedule, terms, signatures
  - `credit.score.{a,b,c,d,new}`
  - `credit.reminder.*`: due_soon, overdue

## W4-H Payments and overdue UI
**Owns:** `src/modules/credit_sales/ui/record-payment.tsx`, `src/modules/credit_sales/actions/payments.ts`, `src/app/[locale]/(app)/credit/payments/**`, `src/app/[locale]/(app)/credit/overdue/**`
- `RecordPaymentButton` is a Dialog. Amount is a DZD text (default = the next due amount if known, else empty), method, reference, and a down payment checkbox. Its action calls recordPayment. On success it shows a toast with the receipt number and a link, then `router.refresh()`.
- `/credit/payments` is a DataList of payments.
- `/credit/overdue` lists overdue rows grouped by partner, with the total due, days late, a **Call** (`tel:`) link and a **WhatsApp** link (`whatsappLink(phone, buildReminderMessage(locale, …))`), plus a "due in the next 7 days" section.
- Use only `credit.*` keys from the list in W4-G.

## W4-I Receipts and printable contract
**Owns:** `src/app/[locale]/(app)/credit/receipts/**`, `src/app/[locale]/(app)/credit/contracts/[id]/print/**`, `src/app/api/credit/receipts/[id]/pdf/route.ts`, `src/modules/credit_sales/print/*`
- `print/receipt-html.ts` and `print/contract-html.ts` are pure functions that return a full HTML string (inline CSS, A5 receipt / A4 contract, `dir` by locale, Noto Sans Arabic from Google Fonts). They include the company's legal name, NIF, RC and address, and the partner. The contract includes lines, schedule, terms placeholder and signature boxes. Mark the legal mentions with `<!-- ⚠ needs accountant/lawyer verification -->`.
- The pages render the same content as React, with a print button (`window.print()`) and print CSS that hides the shell.
- The PDF route requires a session and tenant (use page-ctx). It renders the HTML with `getPdfRenderer()` and returns `application/pdf`. When the error is PDF_NOT_CONFIGURED, it redirects to the print page.
- Unit tests: the HTML contains the number, amounts formatted in DZD, and `dir="rtl"` for ar.

## W4-J Client scoring
**Owns:** `src/modules/credit_sales/service/scoring.ts`, `src/modules/credit_sales/ui/score-badge.tsx`, `src/modules/credit_sales/events.ts`, `src/modules/credit_sales/__tests__/scoring.test.ts`, `src/modules/credit_sales/__tests__/scoring.int.test.ts`
- `computeScore(history)` is a pure function. Inputs: the counts of installments paid on time, paid late (with avg days late), currently late, and completed contracts. Output: grade A/B/C/D, or 'new' when there's no history, plus a 0–100 number and reasons[].
  - Rules: start at 70. +5 per completed contract (max +15), +1 per on-time payment (max +15), −3 per late-paid installment, −10 per currently late installment, and −1 per 5 average days late. Clamp to 0..100. A ≥ 80, B ≥ 60, C ≥ 40, else D.
  - Document these rules in a comment as a heuristic, not a credit bureau.
- `refreshScore(ctx, partnerId)` queries the history and inserts a client_scores row.
- `events.ts` registers `on('credit_sales.payment.recorded', …)` → refreshScore. It's imported for its side effects from `src/modules/credit_sales/index.ts` (you may add that one import line).
- `ScoreBadge` shows the latest score, colored, with the reasons in a title tooltip.
- Unit tests for every rule.

## W4-K CRM service
**Owns:** `src/modules/crm/service/*`, `src/modules/crm/__tests__/*`
- `ensureDefaultPipeline(ctx)` is idempotent and creates DEFAULT_PIPELINE.
- `listLeads(ctx, q)` (rows include stageId, stageName, partnerName, expectedCents, salespersonName and nextActivityDate), `leadsByStage(ctx, pipelineId)`, `getLead`, `createLead` and `updateLead`.
- `moveLead(ctx, id, stageId)`: if the stage is_won, mark the lead won. Audit, and post a chatter system message.
- `markLost(ctx, id, lostReasonId?, note?)` and `reopenLead`.
- `convertToContract(ctx, leadId, draft: Omit<DraftContractInput,'leadId'|'partnerId'>)`:
  - Requires the lead's partner. If there's none, create a partner from the lead contact fields first.
  - Calls `createDraftContract` with leadId, sets converted_contract_id and marks the lead won.
- `listLostReasons` / `createLostReason`.
- **Integration test:** pipeline seeding, move, lost, and convert (creates a draft contract).

## W4-L CRM UI
**Owns:** `src/app/[locale]/(app)/crm/**`, `src/modules/crm/actions.ts`, `src/modules/crm/ui/*`, `messages/*/crm.json`
- `/crm` is a Kanban by stage (calls ensureDefaultPipeline first). A toggle switches to a list view (DataList), and there's a "new lead" button.
- `/crm/new` is a form.
- `/crm/[id]` shows details and an edit form, with actions:
  - Mark won
  - Mark lost (dialog with a reason)
  - Convert to credit contract (redirects to `/credit/contracts/new?lead={id}`; that page may ignore the param for now)
  - Call / WhatsApp links
  
  Plus `<Chatter entity="crm.lead">`.

## W4-M Page ctx, dashboard and shell polish
**Owns:** `src/core/actions/page-ctx.ts`, `src/core/actions/define-action.ts` (only the active-company fallback), `src/app/[locale]/(app)/dashboard/**`, `src/ui/shell/*`, `messages/*/shell.json`, `src/core/dashboard/*`
- `withPageCtx`: as described above. When the active-company cookie is missing or invalid, use the first company. Do the same fallback inside defineAction.
- Shell fixes:
  - user-menu imports `authClient` from `@/core/auth/client`.
  - Menu labels are i18n keys and must be translated: labels look like `contacts.menu.partners`, so use `useTranslations()` with the full key, falling back to the raw key.
  - Active menu item highlighting.
- `src/core/dashboard/kpis.ts`: `dashboardKpis(ctx)` returns `{ dueTodayCents, overdueCents, overdueCount, collectedThisMonthCents, activeContracts, openLeads }` via SQL over the credit and crm tables. If a module is disabled, return 0 for its values.
- **Dashboard:** KPI cards, a "due today / overdue" quick list (top 5, linking to the contract), `<MyActivities limit={8}/>`, and quick actions (new contract, new contact, new lead).
- Integration test for the KPIs on an empty company (all zeros).

## W4-N Reminders job
**Owns:** `src/modules/credit_sales/service/reminders.ts`, `src/modules/credit_sales/jobs/daily-reminders.ts`, `src/app/api/cron/daily/route.ts`, `src/modules/credit_sales/__tests__/reminders.test.ts`
- `buildReminderMessage(locale, d)`:
  - fr: polite French.
  - ar: Modern Standard Arabic.
  - en: English.
  - Due soon vs overdue wording comes from d.daysLate (> 0 means overdue). Amounts use formatDzd. It includes the shop name and contract number.
- `whatsappLink(phone, text)` normalises Algerian numbers: `0[567]XXXXXXXX` → `213…`, and `+213`/`00213` are handled. It returns `https://wa.me/213…?text=…` (encoded), or null if invalid.
- `runDailyReminders(db)`: for each company with credit_sales enabled (owner connection to list companies), run within `withTenant` as a system user. Use the company owner's user id from memberships. For installments due in 3 days or overdue, call `ensureActivity` (type payment_reminder, assignee = the contract salesperson or the owner). Return counts.
- `/api/cron/daily` is a POST protected by `CRON_SECRET` like `/api/cron/outbox`, and calls runDailyReminders.
- Unit tests: phone normalisation cases, and message content for the 3 locales.
