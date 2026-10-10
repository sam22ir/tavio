# App audit: what's missing in each app (2026-10-10)

A read-only code audit of all 20 apps, plus the links between them compared with Odoo 17–18. Each gap is tagged:
- **[P1]** must have before selling
- **[P2]** should have
- **[P3]** nice to have

Every item was checked in the code. Tax, stamp duty and SCF items still need an Algerian accountant (see ACCOUNTANT_REVIEW.md).

## Summary: P1 by theme

**Wrong numbers (fix first)**
- A discount on a quote is lost when it becomes an invoice: invoice lines have no discount field.
- A purchase order can be billed only once. Goods received after the first vendor bill are never billed.
- Credit contract activation books the sale but doesn't take the goods out of stock.
- Stock has no valuation, and stock moves never post to accounting.
- Stamp duty is added at payment time, not on the invoice. It needs accountant verification.

**Missing links between apps (vs Odoo)**
- A CRM lead can only become a credit contract, not a quote or sale order. Website forms don't create leads.
- A sale order is invoiced all at once, not by delivered quantity.
- Website orders are converted to sale orders by hand and aren't linked to the invoice or payment.
- There's no customer portal for viewing invoices and contracts or paying.
- No CSV/XLSX import or export anywhere in the app.
- WhatsApp, SMS and email aren't actually sent: everything goes through manual wa.me links.

**Legal and printing (Algeria)**
- The printed quote and the POS ticket have no NIF/RC/AI and no VAT-by-rate breakdown.
- The printed credit contract has placeholder clauses, and there's no guarantor workflow.
- No TAP, IBS or IRG, and no withholding tax. G50 is a draft with no save, print or export.
- No fiscal year or period lock, no bilan or TCR, no bank reconciliation and no accountant export. The chart of accounts can't be edited (only 11 accounts).

**Missing basics inside apps**
- Products have no images, no variants, and can't carry a TVA rate.
- The e-shop has no SEO and no delivery fee per wilaya.
- POS has no refunds and no barcode scanning.
- Credit contracts can't be amended, paid off early or rescheduled.
- CRM pipelines and stages can't be managed from the UI.
- Contacts have no duplicate check.
- Stock has no per-warehouse view.
- HR has no payroll (CNAS/IRG), no employment contracts and no leave balances.
- Helpdesk has no SLA and no email or WhatsApp intake.
- Projects can't bill time.
- The AI provider can't be set from the UI.
- The API has narrow scopes and no webhook log.
- Automation rules need raw field names, and there are few triggers.
- Subscriptions have placeholder prices, no CIB/Edahabia/BaridiMob payment and no self-service upgrade.

**Platform features Odoo has on every model:** smart buttons (related-record counts), an attachments UI, saved filters, email templates, calendar and pivot views, and multi-currency. Chatter is on about 10 detail pages but not on invoices, POS or projects. Note: global ⌘K search does exist in the new top bar.

---

# Acquisition and operations apps audit (read-only)

Scope: CRM, Site web / e-shop, Marketing, Contacts, Produits. Verified by reading modules, routes, schemas and manifests. Cross-app finding: no CSV/XLSX library exists anywhere in `src/` (grep for csv, xlsx, exceljs, papaparse), so no app has import or export.

## CRM
**Has:** leads list (DataList), kanban by stage with drag-and-drop (shared `ui/views/kanban.tsx`), create/edit/detail with chatter, mark won / lost (with lost reasons) / reopen, convert lead to contract, pipelines and stages tables, tags tables, lead fields for wilaya, source, probability, expected revenue, salesperson, priority.
**Missing / broken:**
- [P1] No import or export of leads (no CSV/XLSX anywhere; list has no export action).
- [P1] No pipeline or stage management UI. Only `DEFAULT_PIPELINE` in `crm/schema.ts` and the stage relation; no settings page under `(app)/settings` for CRM.
- [P2] No activity model (calls, meetings, next action with due date). Chatter is the only follow-up trail.
- [P2] No tag UI on leads, although tags tables exist.
- [P2] Module depends on `chatter` and `credit_sales`, and the CRM test notes these are stubs in this worktree.
- [P3] No kanban column totals (sum of expected revenue) and no quick-create per column.

## Site web / e-shop
**Has:** website settings page (slug, enabled, title, about, WhatsApp phone, show prices), public shop `/[locale]/shop/[slug]` with product page, cart, checkout (COD), orders list and detail with chatter, convert order to sale order, cancel order. Wilaya code validated, rate limit of orders per phone per hour, prices read server-side.
**Missing / broken:**
- [P1] No product images. Products have no image field and the shop has no `<img>` or image handling.
- [P1] No SEO metadata: no `generateMetadata`, no `openGraph`, no sitemap in `src/app/[locale]/shop`.
- [P1] No delivery fee or shipping rule by wilaya, though checkout asks for wilaya and COD totals ignore it. The `wilaya` field is captured but not used for pricing.
- [P2] Naive rate limit (phone-based only, in `service/public.ts`), no captcha or anti-bot.
- [P2] No order notifications (WhatsApp or email) to the shop owner or the customer.
- [P2] No product categories or search in the storefront.
- [P3] No custom domain or theme settings beyond title and about text.

## Marketing
**Has:** campaigns list, create and edit, bilingual FR/AR message with placeholder preview, segment (customer, prospect, wilaya, overdue), build recipients, recipient cards with WhatsApp `wa.me` links and sent/failed status buttons, Chatter on campaign detail. Channel options whatsapp, sms, email exist in the schema.
**Missing / broken:**
- [P1] SMS and email channels are selectable but nothing sends them. No provider integration (no Twilio, Meta, SMTP or similar found in `src/modules/marketing`).
- [P1] No WhatsApp Business API sending. Sending is manual via `wa.me` links, so there is no bulk send, delivery status or reply tracking.
- [P2] No scheduling of campaigns. Schema only has states draft, ready, sent.
- [P2] No unsubscribe or opt-out list. Required for SMS and email in practice.
- [P2] No campaign results (sent count, reply rate) beyond per-recipient status.
- [P3] No templates library and no image attachment for WhatsApp messages.

## Contacts
**Has:** partners list, create, edit, archive (no hard delete), detail with tabs, contact persons (`partnerContacts`), custom fields editor, ScoreBadge, Chatter, search partner options, NIF/NIS/RC/AI fields, national ID encrypted at app level with HMAC for lookup.
**Missing / broken:**
- [P1] No import or export of partners (no CSV anywhere).
- [P1] No duplicate detection on save beyond the national ID hash. Name, phone and NIF duplicates are not checked.
- [P2] No merge-duplicates action.
- [P2] No partner addresses list (only one address per partner was verified in schema) or delivery address book.
- [P2] No Algerian tax-field validation: NIF, NIS, RC and AI accepted as free text, no format check.
- [P3] No mobile-specific layout check was found beyond the shared DataList.

## Produits
**Has:** products list (DataList) with name, code, SKU, barcode, category filter, kind filter (goods or service), active filter, create and edit forms, category add form, UoM relation, sale and cost price in DZD, track stock flag, Arabic name, description.
**Missing / broken:**
- [P1] No product image upload and no image field in the schema.
- [P1] No product variants (size, colour). Schema has no variant table.
- [P1] Tax is not selectable: `defaultTaxId` exists in schema but is not in the product entity or the form, so products cannot carry a TVA rate.
- [P2] Barcode field exists but no barcode generation, scanner input or label printing.
- [P2] No stock view on the product (`trackStock` is only a flag; quants live in another module).
- [P2] Product detail has no Chatter and no history, unlike CRM and Contacts.
- [P2] No import or export (no CSV anywhere).
- [P3] No product price lists (wholesale or retail tiers) and no supplier price list.

## Verified stubs and placeholders
- `src/modules/crm/__tests__/crm.int.test.ts:29` says Chatter and credit sales are "stubs in this worktree" and are mocked in tests.
- No TODO, FIXME or "coming soon" markers in the five modules or their routes. The `placeholder` hits are form input hints (`placeholder="16"`, `t('noReason')`) and the marketing `{name}` template placeholders, which are working features.

---

# B. Sales apps audit (read-only)

Scope: src/modules/{sales,credit_sales,pos,invoicing} and their (app) routes. No repo files edited, no builds, no DB access.

## Ventes (quotes and orders)

**Has:** quote/order CRUD with lines (qty, DZD price, percent discount, tax), draft to sent to confirmed (SO-YYYY-NNNNN) to invoiced/done, cancel, invoice creation via invoicing, quote print page (window.print), order list with state/invoiced filters, audit and sales.order.confirmed event.

**Missing / broken:**
- [P1] Discounts are lost on invoicing. `createInvoiceFromOrder` (src/modules/sales/service/orders.ts ~L386-420) passes only productId, description, quantity, unitPriceCents and taxId. `NewInvoiceLine` in src/modules/invoicing/service/create.ts has no discount field, so an invoice from a discounted quote is billed at full price.
- [P1] Printed quote lacks Algerian legal identity. src/app/[locale]/(app)/sales/[id]/print/page.tsx never loads the company (no NIF/NIS/RC/AI) or the customer's NIF, and shows no per-rate VAT breakdown or stamp duty. Only untaxed, VAT total and grand total are printed.
- [P1] Invoicing is all-or-nothing. `createInvoiceFromOrder` invoices the entire order once, sets `invoiced=true` and `state='done'`. There is no partial, progressive or delivery-based invoicing, so a partial delivery cannot be billed.
- [P2] No delivery tracking on the order. The inventory module listens to `sales.order.confirmed` (src/modules/inventory/events.ts), but the order has no delivered or shipped state, no link to the stock move, and no delivery status in the UI.
- [P2] `validityDate` is stored and printed but never enforced: no expired state, no block on confirm after expiry.
- [P2] "Sent" is a manual state flip (`markOrderSent`). There is no email or PDF send, no quote duplication or revision, and no customer acceptance step.
- [P2] `cancelOrder` emits no event, so stock reservations and any downstream records are not released on cancel.
- [P2] No order-level discount or global remise (discount exists only per line).
- [P2] No returns path from the order; refunds exist only on the invoicing side (`createRefund`).
- [P3] `salespersonId` is always set to the creator; no salesperson choice, no payment-terms field.
- [P3] Customer picker loads at most 500 partners with no server-side search (`saleLookups`).
- [P3] Stale comment in `orders.ts` ("through the invoicing stub") although invoicing is real. No TODO/FIXME/placeholder markers found in this app.

## Ventes à crédit (installment sales)

**Has:** contracts with lines, down payment, markup rate, monthly or weekly schedule, activation with number, cancel (requires "force:" prefix if payments exist), payments allocated oldest-first with gap-free receipts, overdue and due-soon lists, client scoring, daily reminder job, WhatsApp reminder link, AI reminder draft, printable contract and receipt.

**Missing / broken:**
- [P1] Contract terms print as a placeholder. `termsPlaceholder` is "[Clauses du contrat à compléter]" / "[بنود العقد لتعبئتها]" / "[Contract terms to be completed]" (src/modules/credit_sales/print/shared.ts L54, L96, L138), rendered by views.tsx L130 and contract-html.ts L122. The printed contract has no legal clauses.
- [P1] No guarantor (caution) workflow. The `guarantors` table exists (src/modules/credit_sales/schema.ts L294), but there is no service, action, form field, detail section or print block.
- [P1] No contract amendment, early payoff or rescheduling. `service/contracts.ts` only has create/update draft, activate and cancel. Active contracts cannot change, and there is no early-settlement rebate or remaining-balance recompute.
- [P2] No payment correction. The `credit_sales.payment.delete` permission is declared (manifest.ts L17) but no function or action uses it, so a wrong payment cannot be reversed or voided.
- [P2] Cancelling a contract with payments relies on a text prefix (`force:` in the reason, service/contracts.ts ~L372) instead of a proper reversal or settlement flow.
- [P2] No late-payment penalty or interest. Markup is fixed at creation and scoring only affects the client's score.
- [P2] Reminders are not sent. The daily job creates chatter activities for the owner, and the only outbound channel is a WhatsApp deep link (service/reminders.ts `whatsappLink`). No SMS or email.
- [P3] No signature capture, no contract PDF/e-sign, and the contract number is assigned only on activation.

## Point de vente (POS)

**Has:** session open/close with counted cash versus expected cash, product tiles with name search, cart, cash/CIB/EDAHABIA payment, change calculation, paid order creation with server-side prices and tax from defaultTaxId, 80mm ticket with print.

**Missing / broken:**
- [P1] No refund or return flow. `service/orders.ts` only has `createPaidOrder`, and there is no reversal or return action.
- [P1] Ticket lacks legal identifiers and VAT breakdown. The receipt block in src/modules/pos/ui/pos-screen.tsx (~L258-290) shows no seller NIF/RC/AI, no per-rate VAT and no buyer identity, and there is no path to a full invoice for a B2B customer. Needs accountant verification.
- [P1] No barcode scan. Search filters product names only (pos-screen.tsx L71). `products.sku` exists, but there is no barcode/EAN field and no scanner (keyboard wedge) handling.
- [P2] No offline mode. No service worker, IndexedDB queue or retry; a network drop loses the sale.
- [P2] Payment methods are limited to cash, cib and edahabia (service/orders.ts L14). No CCP, cheque, transfer or split payment.
- [P2] No line or cart discount, no customer selection on the sale, and no hold/park cart.
- [P2] Session has no cash-in/cash-out movements or variance reason on close; closing cash is a single typed amount (`closeSession`).
- [P3] Printing is `window.print()` of a web page. No thermal/ESC-POS driver, no cash-drawer trigger.

## Facturation (invoicing)

**Has:** draft invoices and refunds (out_invoice, out_refund, in_invoice, in_refund), posting with gap-free numbering per type and year (AV-/AVF- for refunds), cancel for drafts only, payments with methods (cash, CCP, transfer, CIB, EDAHABIA, cheque) capped at residual, partial/paid states, stamp duty on cash payments, A4 print with NIF/NIS/RC/AI on both parties and VAT by rate, vendor bill scan.

**Missing / broken:**
- [P1] Stamp duty (timbre fiscal) is unverified. Tiers in src/modules/l10n_dz/data.ts L58-66 and the cash-payment rule in invoicing/service/invoices.ts L137-153 are marked "needs accountant verification". Stamp is added to the invoice total at payment time rather than on the invoice.
- [P1] Line discounts are not supported. `computeLine` in service/math.ts has no discount term, so invoices cannot carry the discount agreed on a quote (root cause of the sales P1).
- [P2] No payment receipt (reçu de paiement) print. `paymentsOf` exists, but no print route covers a single payment.
- [P2] Printed invoice has no bank details (RIB/CCP) and no company logo, and does not show paid-to-date or balance due.
- [P2] No receivables aging report. Menus only expose customers and vendors; invoice lists are reachable only through partner pages.
- [P2] No top-level invoice register; `listInvoices` in queries.ts has no matching route.
- [P3] Print template header carries a "needs accountant verification" comment that should be resolved before production use.

---

# C - Operations audit (read-only)

Scope: Stock, Achats, Comptabilite (SCF), Fiscalite (l10n_dz). Code read via grep/find/read only. No repo files edited.

## Stock

**Has:** warehouses (create, auto default "WH" with internal, customer, supplier, inventory_loss locations); stock moves draft -> done -> cancelled with validate/cancel; sales and purchase/POS auto-moves via events (modules/inventory/events.ts); inventory adjustment to a counted quantity (service/adjustments.ts); reorder rules with min/max and low-stock list (service/stock.ts lowStock); moves list and detail; quantities in thousandths.

**Missing / broken:**
- [P1] No per-warehouse stock view. /inventory (app/[locale]/(app)/inventory/page.tsx) calls stockLevels, which sums per product across all warehouses (service/stock.ts). onHandByLocation already returns per-location data but no page uses it.
- [P1] No stock valuation. stockMoves (modules/inventory/schema.ts) has no unit cost, and events.ts never posts stock to accounting (no 3x stock accounts exist in the SCF seed, service/chart.ts).
- [P2] Negative stock is allowed. postMove (service/moves.ts) and validateMove do not check on-hand, so a delivery can validate with no stock.
- [P2] No inventory count session. createAdjustment handles one product at one location per call (service/adjustments.ts); there is no count sheet or multi-line count.
- [P2] No multi-line transfer document between warehouses. A move is one product line (moveInput in actions.ts), and listMoves filters only by state (service/moves.ts).
- [P2] No lot or serial tracking. No lot/serial columns in modules/inventory/schema.ts or modules/products.
- [P2] Reorder rules can be created but not edited or deleted (actions.ts exports only createReorderRuleForm). Low stock gives a toOrder quantity but does not create an RFQ or PO.
- [P2] Warehouses are create-only. The active column (schema.ts) has no archive or edit action (actions.ts, warehouses/page.tsx).
- [P2] Adjustments have no reason codes; the loss location is one company-wide "Inventory adjustments" location (warehouses.ts).
- [P3] No stock card (per-product movement history) and no inventory valuation report.

## Achats

**Has:** purchase orders with draft, confirmed, partial and full receipt, cancel before any receipt, vendor bill from received quantities, per-line tax, cost prefill from product (modules/purchases/service/orders.ts, state.ts, lookups.ts; pages under app/[locale]/(app)/purchases).

**Missing / broken:**
- [P1] Bill-once bug. createBillFromOrder (service/orders.ts ~L316-352) sets billed = true after the first bill, and canBill (service/state.ts) returns false when billed. Goods received after that first bill are never invoiced.
- [P2] RFQ stage does not exist. 'sent' is in PURCHASE_ORDER_STATES and canConfirm/canCancel, but nothing sets state to 'sent' (grep finds no transition). Dead state.
- [P2] No supplier price lists. The price is product costCents (service/lookups.ts ~L25-40), with no partner-specific price or validity date.
- [P2] Receipt is immediate. receiveOrder posts stock moves with post: true (modules/inventory/events.ts), so there is no draft receipt to check before stock changes.
- [P2] No print or PDF for the purchase order or RFQ (no print route under app/[locale]/(app)/purchases).
- [P2] Vendor bill does not record the supplier's invoice number. Only the PO number goes into origin (service/orders.ts createInvoice call).
- [P2] No return to vendor. canCancel blocks any order with a receipt (state.ts), and no return flow exists.
- [P3] Low-stock toOrder figures do not create a draft PO from inventory.

## Comptabilite (SCF)

**Has:** SCF seed of 11 accounts (service/chart.ts SCF_CHART_SEED), 5 fixed journals (VT, AC, CA, BQ, OD), manual entries with balance check, reversal, auto-posting from invoices, payments, POS and instalment credit (service/posting.ts), trial balance, general ledger, partner balances 411/401, G50 monthly draft (service/reports.ts; app/[locale]/(app)/accounting/reports/page.tsx).

**Missing / broken:**
- [P1] No fiscal year and no period lock. postEntry (service/entries.ts) accepts any date, and no table or closing entry exists in modules/accounting/schema.ts.
- [P1] No bilan (balance sheet) and no TCR (income statement). REPORTS in reports/page.tsx is trial, ledger, partners and g50 only.
- [P1] No bank or cash reconciliation. reconcilable is set on 512 and 53 (chart.ts), but nothing reads it. There is no statement import or matching.
- [P1] No export for the accountant (no CSV, Excel, PDF or FEC anywhere in the accounting module or pages).
- [P1] Chart and journals are read-only in the UI. accounts/page.tsx and journals/page.tsx have no forms, and actions.ts exposes only manual entry and reverse. Only the 11 SCF accounts can be used.
- [P2] Entries post straight to state 'posted' (entries.ts ~L47). There is no draft or review state for manual entries.
- [P2] Trial balance has no opening balances or carry-forward; accountTotals filters by date only (reports.ts).
- [P2] Stamp duty on purchase bills posts Dr 445 (posting.ts invoiceLines). The code itself marks this as needing accountant verification.
- [P2] Partner balances have no ageing buckets (reports.ts partnerBalances).
- [P3] Journals are the five fixed seeds; custom journals are not possible.

## Fiscalite (l10n_dz and settings)

**Has:** TVA 19% and TVA 9% seeds (modules/l10n_dz/data.ts), tax CRUD with archive at /settings/taxes, stamp duty tiers used on cash payments of customer invoices (modules/invoicing/service/math.ts stampDutyCents, invoices.ts ~L150), G50 monthly VAT draft (modules/accounting/service/reports.ts g50Draft), company NIF/NIS/RC/AI fields (core/db/schema/tenancy.ts).

**Missing / broken:**
- [P1] TAP (taxe sur l'activite professionnelle) does not exist. A grep for TAP across src returns nothing.
- [P1] IBS and IRG do not exist, and there is no retenue a la source (withholding) on purchases or services. A grep for IBS, IRG and retenue finds nothing.
- [P1] G50 is a monthly draft only. g50Draft computes figures on the fly, with no saved declaration, no period lock, no print or export, and g50Summary flags needsAccountantReview.
- [P2] VAT accounts are hard-coded (4456, 4457 in posting.ts), so there is no per-tax account mapping. TVA 9% scope is flagged as unverified in data.ts.
- [P2] Stamp duty tiers are hard-coded in data.ts and applied only to cash payments on out_invoice (invoices.ts ~L150). Other payment methods are not covered, and tiers cannot be edited in settings.
- [P2] No fiscal regime setting (real regime versus flat-rate). This is needed to decide TAP, IBS and IRG treatment, and no field for it was found in tenancy.ts.
- [P3] No tax period history or declaration archive.

## Cross-cutting

- Grep for TODO, FIXME, placeholder, coming soon, stub and not implemented in the four module folders and their app routes found nothing relevant (the one "placeholder" hit is an input hint, app/[locale]/(app)/purchases/[id]/page.tsx:145).
- Seed data is marked "needs accountant verification" throughout (service/chart.ts, l10n_dz/data.ts). Treat all rates, tiers and account choices as unverified.

## P1 counts

- Stock: 2
- Achats: 1
- Comptabilite (SCF): 5
- Fiscalite: 3

---

# Revora audit: D-platform (read-only)

## RH (HR)
**Has:** departments; employee file (name, job title, department, manager, hire date, phone, email, NIN, active toggle, link to user); leave types and leave requests with submit, approve/reject; attendance check-in/out with monthly summary; self check-in/out forms.
**Missing / broken:**
- [P1] No payroll at all: no salary fields, no payslips, no IRG or CNAS computation. Grep for payroll/paie/cnas/irg returns nothing in the module, schema or messages.
- [P1] No employment contracts: no contract entity, no contract type (CDI/CDD), no trial period or end date. Only hireDate exists.
- [P1] No leave balances or accrual: leave types carry no annual allowance, and there is no public-holiday calendar.
- [P2] Attendance has no work schedule or shift model, no overtime (heures supplementaires), and no late or absence tracking.
- [P2] Employee file lacks birth date, address or wilaya, bank RIB, emergency contact, and dependants (needed for IRG deductions).
- [P2] No employee document attachments (ID, diploma, contract scans).
- [P3] No recruitment, appraisal or training.

## Projets (Projects)
**Has:** projects with stages and state change; tasks with stage, priority, deadline and assignee; kanban on project page; task detail page with move action; timesheets (hours per task per user per day) with logTimesheet and sumHours.
**Missing / broken:**
- [P1] No billing link: timesheets have no billable flag or rate, and nothing turns hours into an invoice. No billable/rate/invoice logic in src/modules/projects.
- [P2] Sidebar exposes only /projects. Tasks and timesheets have no menu entry (the manifest lists one menu).
- [P2] No project profitability or budget-vs-actual view.
- [P2] No task dependencies, milestones, or Gantt/calendar view.
- [P3] No project templates or recurring tasks.

## Support (Helpdesk)
**Has:** support teams; tickets with auto number (TK-YYYY-NNNNN), stages new, in_progress, waiting, solved, closed with enforced transitions; priority; channel (whatsapp, phone, email, walk_in); assignee; team; list, kanban board, new and detail pages.
**Missing / broken:**
- [P1] No SLA: no response or resolution deadline fields, no SLA policy, no overdue or escalation logic. Grep for sla/escalat in the module returns nothing.
- [P1] Email and WhatsApp intake do not exist. "Channel" is a label picked by hand. No inbound email or WhatsApp route or connector was found under src/app/api.
- [P2] No outbound reply: the ticket has one description column and no message thread that sends email or WhatsApp to the customer.
- [P2] No customer portal and no CSAT survey.
- [P3] No knowledge base and no ticket tags or categories.

## Assistant IA (AI assistant and AI features)
**Has:** assistant chat with read-only tools (kpis, low_stock, overdue, top_customers_month, unpaid_invoices); AI reminder drafting; natural-language search; vendor-bill OCR scan and confirm (route /invoicing/vendors/scan); settings/ai page showing provider, model and monthly usage. Adapters: anthropic, openai-compatible, mock.
**Missing / broken:**
- [P1] AI provider cannot be configured in the UI. getAi() returns null unless AI_API_KEY is set in the environment. settings/ai only displays the provider and model.
- [P2] Assistant tools are read-only. It cannot create or update records (invoice, task, ticket, leave, reminder send).
- [P2] Assistant tools cover no HR, projects or helpdesk data (list is only the five tools above).
- [P3] No voice input. The chat input is a plain text field.

## Plateforme / API (platform: API keys, REST, webhooks, custom fields)
**Has:** API keys (create, revoke, hashed storage, scopes); REST v1 for contacts, products and invoices; OpenAPI document builder; webhooks (create, active toggle, https validation, HMAC signature, deliveries table with attempt counter); custom fields for contacts.partner with validation; settings/platform page with custom fields, keys and hooks sections.
**Missing / broken:**
- [P1] No webhook delivery log or replay UI. webhookDeliveries exists in the schema, but platform-settings.tsx never reads it.
- [P1] API scopes are too narrow: only contacts:read, products:read, products:write, invoices:read. No write for contacts or invoices, and no endpoints for sales, purchases, stock, HR, projects or helpdesk.
- [P2] API keys have no expiry or rotation (no expir/rotat matches in api-keys.ts or the UI).
- [P2] Webhook events and automation triggers share the same 7 events. None cover contact, invoice creation, HR, projects or helpdesk.
- [P2] Custom fields exist only for contacts.partner (CUSTOM_ENTITIES). Products, invoices, tickets and employees have none.
- [P2] No public API docs page in the app. The OpenAPI builder exists in service/openapi.ts, but I found no docs page that serves it.
- [P3] outbox-handler.ts increments attempts but shows no backoff schedule or max-attempt cap.

## Automatisation (Automation)
**Has:** rules with 7 trigger events; conditions (eq, neq, gt, gte, lt, lte, up to 20); 3 actions (create_activity, post_note, https webhook); {field} template rendering; settings/automation rule form.
**Missing / broken:**
- [P1] No rule builder. rule-form.tsx uses free-text inputs for entity ("sales.order"), recordIdField ("orderId") and condition field paths. Users must know payload field names.
- [P1] Triggers are limited to 7 sales, invoicing, purchases, POS, inventory and credit events. There is no HR, helpdesk or projects trigger, no record created or updated trigger, and no scheduled or time-based trigger.
- [P2] Actions are limited to 3. No send email or WhatsApp, set field, assign user, or create task or ticket.
- [P2] No run history: the module has one table (automationRules), so there is no execution log.
- [P2] No test or dry-run for a rule.

## Abonnement (Subscriptions / SaaS billing)
**Has:** plans free, pro and business (module allow-lists, seat limits); company_subscriptions with state (trial, active, past_due, cancelled), seats and payment_method (ccp, transfer, cash); settings/billing page showing plan, state, seats, monthly total and CCP or bank-transfer instructions.
**Missing / broken:**
- [P1] Prices are placeholders. plans.ts marks 2 900 DZD (pro) and 5 900 DZD (business) as "placeholder, confirm before launch".
- [P1] No Algerian online payment. Grep for CIB, Edahabia, BaridiMob, Chargily and SATIM finds nothing outside a test file. The payment_method check allows only ccp, transfer and cash.
- [P1] No self-service upgrade, checkout or plan change. billing page is display-only.
- [P2] No SaaS invoices or receipts, and no renewal or dunning flow, even though past_due exists as a state.

---

# E-links: cross-app links audit (read-only)

## What links exist today

| Source (event or action) | What happens | Where |
|---|---|---|
| `sales.order.confirmed` | Draft delivery moves internal to customer, one per line; not validated | inventory/events.ts |
| `purchases.order.received` | Posted receipt moves supplier to internal (stock is in on receipt) | inventory/events.ts |
| `pos.order.paid` | Posted stock moves internal to customer | inventory/events.ts |
| `pos.order.paid` | Sale entry (CA or BQ by method) | accounting/events.ts |
| `invoicing.invoice.posted` | Journal entry (VT for sales, AC for purchases) | accounting/events.ts |
| `invoicing.payment.registered` | Payment entry (CA or BQ), stamp included | accounting/events.ts |
| `credit_sales.contract.activated` | Sale entry (VT) for financed amount | accounting/events.ts |
| `credit_sales.payment.recorded` | Payment entry (CA or BQ); also refreshes credit score of partner | accounting/events.ts, credit_sales/events.ts |
| All 8 catalog events | Automation rules run: create_activity, post_note, webhook (outbox) | event-handlers.ts, automation/engine.ts |
| Direct call: `sales.createInvoiceFromOrder` | Calls invoicing `createInvoice` for whole order, sets SO `invoiced` and `done` | sales/service/orders.ts |
| Direct call: `purchases.createBillFromOrder` | Vendor bill (in_invoice) on received qty only | purchases/service/orders.ts |
| Direct call: `crm.convertToContract` | Creates partner from lead and a draft credit contract | crm/service/leads.ts |
| Direct call: `website.convertWebOrderToSale` | Draft SO, partner found or created, product matched by id | website/service/convert.ts |
| Direct call: invoicing `createRefund` | out_refund linked by refundOfId | invoicing/service/create.ts |
| Reorder rule (manual) | Low-stock page; no automatic RFQ | inventory/service/stock.ts |
| Marketing campaign | Recipients built from contacts segment (customer, prospect, wilaya, overdue) | marketing/service/campaigns.ts |
| Daily cron | Credit reminders job; WhatsApp reminder is a wa.me link the user clicks | api/cron/daily, credit_sales/service/reminders.ts |
| Helpdesk ticket | Partner FK only | helpdesk/schema.ts |
| POS order | Partner FK only | pos/schema.ts |
| UI buttons | Sale order "create invoice"; purchase order "create bill"; web order "convert"; leave approve | sales/[id], purchases/[id], website/actions.ts |
| UI chatter | Chatter on sales, purchases, CRM, contacts, helpdesk, credit contracts, accounting entries, inventory moves, HR employees, web orders | app pages |
| Not present | No cross-module smart-button counts on any detail page; no links from contacts to orders, invoices or tickets | |

## Odoo flows vs ours

- CRM lead to quotation to sale order: ⚠️ Lead converts to a credit contract (`convertToContract`), not to a quotation or sale order. No lead-to-SO path. [P1]
- Won / lost reasons: ⚠️ Lost reasons, mark lost and reopen exist (`lost-reasons.ts`, `markLost`). No explicit won reason; won is only a pipeline stage. [P2]
- Lead from website form or WhatsApp: ⚠️ `whatsapp` is a lead source value, but the website creates web orders, not leads. No lead from a website contact form. [P1]
- SO to delivery (stock picking): ⚠️ Confirmation creates draft delivery moves and `validateMove` exists. No picking document linked back to the SO; SO page shows only chatter. [P2]
- SO to invoice based on delivered qty: ❌ `createInvoiceFromOrder` bills all lines regardless of delivery. No invoice policy, no partial invoicing. [P1]
- Down payments on SO: ❌ Down payment exists only on credit contracts. [P2]
- SO to purchase (dropship / MTO): ❌ Not found. [P2]
- Credit sale contract: stock out, invoice/journal, installments: ⚠️ Journal entries on activation and on each payment exist. Activation creates no stock move, so goods leaving the shop are not in stock. [P1]
- Credit reminders to marketing / WhatsApp: ⚠️ Daily reminder job and wa.me link exist, but sending is manual, one click per customer. [P2]
- POS session close to stock moves and journal entries: ⚠️ Per-order stock moves and entries fire on payment. `closeSession` emits no event and posts no session-level entry (cash variance not verified). [P2]
- POS customer to contacts: ✅ `partnerId` FK to partners (pos/schema.ts).
- POS loyalty: ❌ Not found. [P3]
- Purchase reorder rule to RFQ: ⚠️ Reorder rules and low-stock page exist; no automatic RFQ. [P2]
- PO to receipt to vendor bill: ✅ `receiveOrder` posts receipt moves and `createBillFromOrder` bills received qty.
- 3-way match: ⚠️ Bill uses received qty and PO price. No check that bill matches PO or receipt, nor tolerance. [P2]
- Landed costs: ❌ Not found. [P3]
- Invoicing to accounting: posting ✅ (event), payments ✅ (event), credit notes ✅ (out_refund via `createRefund`). ⚠️ No reconciliation / matching UI (only a reconcilable flag in chart.ts). [P2]
- Follow-up levels: ⚠️ Credit reminders only; no invoice follow-up levels. [P2]
- Inventory to accounting, perpetual valuation: ❌ Stock moves post no valuation entry; inventory events do not reach accounting. [P1]
- HR to projects timesheets to invoicing (bill time): ⚠️ `logTimesheet` exists; no billing of time to invoice. [P2]
- HR to accounting, payroll entries: ❌ No payroll or payslip code found. [P1]
- Expenses: ❌ Only an expense account in chart; no expense claims. [P2]
- Helpdesk to contacts: ✅ Ticket has partner FK and a partner picker on the new-ticket page.
- Helpdesk to sales/invoices: ❌ No link from ticket to order or invoice. [P2]
- Ticket to task: ❌ Not found. [P2]
- Website order to SO to stock to invoice/payment: ⚠️ Web order is converted by hand to SO, then stock and entries follow. Invoice and payment from web order are not linked. [P1]
- Customer portal (view invoices, contracts, pay): ❌ No portal code found. [P1]
- Marketing to contacts segments: ✅ `buildRecipients` by customer, prospect, wilaya, overdue.
- Marketing campaign to leads: ❌ Not found. [P2]
- Mass messaging from any list: ⚠️ Channel field (whatsapp, sms, email) and recipients table exist; WhatsApp is sent by the user via wa.me; sending not verified for sms or email. [P1]

## Platform features on every app

- Chatter (messages, activities, followers): ⚠️ On ~10 detail pages (sales, purchases, CRM, contacts, helpdesk, credit contracts, entries, moves, HR, web orders). Not confirmed on invoices, POS or projects.
- Attachments: ⚠️ `files` table and `core/files/service.ts` exist; no attachment UI found. [P2]
- Smart buttons: ❌ Only action buttons; no related-record counts or links. [P2]
- Global search: ⚠️ AI search over contracts, partners and products (`ai_features/search`); no global nav search found. [P2]
- Multi-company: ✅ `companyId` on tables and in ctx.
- User and role permissions per app: ✅ `requirePerm` in `core/perms`.
- Audit log: ✅ `audit_log` table and `audit()` calls on writes.
- Import / export CSV or XLSX: ❌ None found on list pages. [P1]
- List view: ✅ on all list pages with filters (`ListQuery.filters`).
- Kanban view: ✅ CRM and helpdesk boards.
- Calendar view: ❌ Not found in UI. [P3]
- Pivot view: ❌ Not found. [P3]
- Graph view: ⚠️ Dashboard and accounting reports; no per-model graph. [P3]
- Group-by: ⚠️ Referenced in core entity types; UI not verified. [P2]
- Saved filters / favorites: ❌ Not found. [P2]
- Email templates: ❌ Only an email adapter; no template model. [P2]
- PDF reports: ✅ Sales print page and credit contract print views.
- Sequences: ✅ `sequences` table and `nextNumber`.
- Multi-currency: ⚠️ DZD only in practice (currency in tenancy and l10n_dz). [P2]
- Scheduled actions: ⚠️ Cron routes (daily, outbox) exist; no user-facing scheduling. [P3]
- Approvals: ⚠️ Leave approve and refuse only. [P2]
- Documents / sign: ❌ Only webhook HMAC signing; no e-signature. [P3]
- Mobile: ⚠️ Not audited for responsive layout in this pass.
- Automation rules UI: ✅ create_activity, post_note and webhook actions with a settings form.

---

