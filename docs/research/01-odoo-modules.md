# Odoo module depth (Odoo 18.0 docs)

Scope: features and workflows as described in the official Odoo 18.0 documentation. Many doc pages are navigation indexes, so some items are known only by title. Enterprise tagging is marked as **[E]** only where a source said so. Items marked **[E?]** come from third-party comparisons and are not confirmed in official docs.

## Pricing (US$, per user per month)

| Plan | Yearly billing | Monthly billing | Notes |
|---|---|---|---|
| Standard | 8.95 | 11.20 | All apps, Odoo Online hosting only |
| Custom | 16.40 | 20.40 | Odoo Online, Odoo.sh, or on-premise; Studio, multi-company, external API, Agentic AI |

The page does not label which price is yearly and which is monthly. The mapping above is inferred from the lower-price-for-yearly pattern. Odoo.sh hosting is extra on Custom. Light User licenses are US$2.90 and need an advisor quote. No minimum user count is stated. A free "One App Free" plan exists (one app, unlimited users, Online).

## CRM
- Leads and opportunities; convert lead to opportunity
- Create leads manually, by email, or from web forms
- Pipeline stages, lost-reason handling, merge duplicate leads/opportunities
- Create and send quotations from the CRM
- Sales teams, activities, partner autocomplete
- Lead mining, lead distribution, resellers
- Reports: pipeline analysis, expected revenue, forecast, unattended leads, marketing attribution
- Predictive lead scoring **[E?]**
- CRM gamification

## Sales
- Quotation templates, quotations, order confirmation
- Online signature and online payment to confirm orders **[E?]**
- Invoicing policies, down payments, pro-forma invoices
- Time-and-materials and project-milestone invoicing
- Pricelists, foreign currency, discounts, discount/loyalty programs
- Optional products, margin tracking, product variants
- Separate delivery and invoice addresses
- Returns and refunds, gift cards and eWallets
- Commission configuration (listed, not detailed)
- Connectors: Amazon, Shopee, Gelato
- Subscriptions and Rental are separate apps (not covered here)

## Invoicing / Accounting
- Automatic double-entry journal entries for invoices, bills, POS, expenses, inventory valuation
- Customer invoices and vendor bills linked to partners; partner ledger
- Bank sync (automatic transaction import) and reconciliation (reconciliation models linked, steps not detailed) **[E?]** for bank sync
- Multi-currency with currency gain/loss after reconciliation
- Fiscal localizations for 100+ countries; fiscal positions (named, not described)
- Multi-company (shared database, per-company chart of accounts) **[E]** per pricing page (Custom plan)
- Branches: share parent chart of accounts, own journals, own lock dates
- Accrual and cash basis reporting
- Reports: balance sheet, P&L, cash flow, tax return, general ledger, trial balance, aged receivable/payable, analytic, budget, deferred revenue/expense; custom reports via report engine
- Inventory valuation: manual (periodic) or automated (perpetual); Standard price, AVCO, FIFO
- Settings: Accounting Firms mode (editable sequences, quick encoding), accountant access, ZIP export
- Some localizations: XML tax report for the tax authority's VAT platform

## Inventory
- Warehouses, locations, operation types, inventory adjustments, cycle counts, scrap
- Receipt and delivery flows in one-, two-, or three steps
- Routes with push/pull rules, putaway rules, storage categories, cross-docking
- Replenishment: MTO, reordering rules, lead times, inter-warehouse replenishment
- Lots and serials, expiration dates
- Removal strategies: FIFO, LIFO, FEFO, closest location, fewest packages
- Reservation: at confirmation, manual, before scheduled date
- Picking: batch, cluster, wave transfers
- Barcode and RFID scanning; GS1 nomenclature **[E?]** for barcode app
- Carrier integrations, shipping labels, multi-package shipments
- Dropshipping and consignment
- Landed costs, valuation by lot/serial
- Reports: forecast, stock, locations dashboard, moves history, valuation dashboard
- Returns appear under Sales, not as a dedicated Inventory workflow

## Purchase
- RFQs, purchase orders, purchase agreements (blanket orders), calls for tenders
- Reusable purchase templates
- Vendor pricelist import
- Reordering rules (permanent and temporary)
- Bill control policies (matching vendor bills to orders)
- Reports: purchase analysis, vendor costs, procurement expenses
- EDI import that turns purchase orders into sales orders
- Receipts and settings are not described in the fetched page

## Point of Sale
- Sessions with opening/closing cash control; several users per session
- Works offline in the browser
- Product search with lazy loading ("Search more")
- Customer assignment unlocks loyalty points, pricelists, invoices
- Refunds (from an order or negative quantity); credit note generation
- Cash in/out with reasons
- Closing control with expected cash by payment method
- Gift cards
- Payment terminals (Adyen, Stripe, Worldline and others); QR payments
- Restaurant, kitchen display (preparation display), self-ordering, combos **[E?]**
- ePOS printers and IoT connection
- Electronic shelf labels **[E?]**

## HR
**Employees**
- Employee records (work info, private info, payroll tab)
- Onboarding and offboarding plans
- Departments with hierarchy
- Certifications with expiry tracking
- Badges, equipment assignment
- Retention report

**Attendance**
- Check-in/out; kiosk mode (badge, RFID, PIN)
- Overtime and approvals; manual attendance records
- Attendance errors and management dashboard

**Time Off**
- Allocations and requests; "My time" view; management reports

**Payroll** **[E?]** (sources disagree on official tagging; treated as Enterprise in most comparisons)
- Contracts and salary attachments
- Salary structures, rules, and parameters
- Work entries and types, time-off conflict resolution
- Payslips (create, process, refund, print), batches
- Commissions, payroll and headcount analysis
- Localizations (Australia, Belgium, Egypt, Hong Kong, Jordan, UAE, Employment Hero)

**Other**: Recruitment and referrals; Appraisals; Frontdesk; Fleet; Lunch

## Project
- Tasks, stages and statuses
- Subtasks and task dependencies
- Recurring tasks
- Project dashboard and profitability
- Timesheets (separate app) with billing rates
- Kanban, milestones, forecast, Gantt not confirmed in the fetched page

## Enterprise-only notes
- Official doc pages fetched did not label Enterprise features in text.
- The pricing page places Studio, multi-company, external API, and Agentic AI in the Custom plan.
- Barcode, Studio, and Payroll are Enterprise per third-party comparisons. Confirm against Odoo's feature list before relying on this.

## Sources
- https://www.odoo.com/pricing-plan
- https://www.odoo.com/documentation/18.0/applications/sales/crm.html
- https://www.odoo.com/documentation/18.0/applications/sales/sales.html
- https://www.odoo.com/documentation/18.0/applications/finance/accounting.html
- https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/inventory.html
- https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/purchase.html (fetched via a different path; the first attempt returned 404)
- https://www.odoo.com/documentation/18.0/applications/sales/point_of_sale.html
- https://www.odoo.com/documentation/18.0/applications/hr.html
- https://www.odoo.com/documentation/18.0/applications/services/project.html
- https://ecosire.com/blog/odoo-community-vs-enterprise (third-party, Enterprise tagging only)
- https://www.cybrosys.com/odoo/compare-odoo-community-vs-enterprise/ (third-party, Enterprise tagging only)
