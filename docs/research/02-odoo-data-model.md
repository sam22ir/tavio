# Odoo data model: core entities and document flow

Scope: Odoo 18.0 Community, read from the official source on GitHub. Concepts are paraphrased; no code is reproduced.

## Core entities

**res.partner** (contacts). Customers, vendors, addresses and companies share this model. Sales orders, invoices, pickings and payments all point to it with many2one.

**res.company** owns settings and chart of accounts. Most business records carry a `company_id` (many2one), and record rules keep users inside their allowed companies.

**res.users** are login accounts that extend a partner. Sales orders and leads carry a salesperson `user_id`.

**product.template / product.product.** The template holds shared product data. The product variant is what is stocked and sold. Unit of measure (`uom.uom`) belongs to a category, and a product's move unit must share that category with the product's own unit.

**res.currency** and **account.tax** are referenced from order lines, invoice lines and payments. Currency comes from the pricelist or company. Taxes attach to lines as many2many (`tax_ids`).

**crm.lead** is one model for both leads and opportunities, selected by a `type` field. It has no `state`. Its pipeline position is `stage_id` (many2one to `crm.stage`) and its win chance is `probability` (0 to 100). Lost records are archived (`active`) and carry `lost_reason_id`.

**sale.order** states: `draft` (quotation), `sent`, `sale` (confirmed order), `cancel`. The main relations are `partner_id`, `user_id`, `company_id`, `pricelist_id`, and one2many `order_line` to **sale.order.line**. Invoices are linked through lines, so `invoice_ids` is computed and not stored. Confirming a quotation is the `action_confirm` method.

**stock.picking** (transfer) states: `draft`, `waiting`, `confirmed`, `assigned` (ready), `done`, `cancel`. The state is computed from its moves. Relations: `picking_type_id` (operation type), `location_id` and `location_dest_id`, one2many `move_ids`, and `partner_id`. `origin` is a plain text reference to the source document. Validation is `button_validate`.

**stock.move** states: `draft`, `waiting`, `confirmed`, `partially_available`, `assigned`, `done`, `cancel`. A move belongs to a picking. It holds the demand (`product_uom_qty`), the reserved or done quantity, and source and destination locations.

**stock.quant** is the on-hand stock of one product at one location, optionally split by lot, package and owner. Its quantity is changed only by stock operations. Zero-quantity quants are cleaned up automatically.

**stock.location** is a hierarchical tree (internal, supplier, customer, inventory adjustment, and so on). Moves go from one location to another, and quants record what sits in each.

**purchase.order** states: `draft` (RFQ), `sent`, `to approve`, `purchase` (confirmed), `done` (locked), `cancel`. Relations: `partner_id` (vendor), one2many `order_line`, and `invoice_ids` (computed vendor bills). Confirmation is `button_confirm`.

**account.move** (journal entry, invoice, bill, credit note, receipt) states: `draft`, `posted`, `cancel`. `move_type` distinguishes entry, customer invoice, customer credit note, vendor bill, vendor credit note, and receipts. Relations: one2many `line_ids` (all journal items), a filtered `invoice_line_ids`, `partner_id`, required `journal_id`, and `company_id`. Posting assigns a sequence number and creates the accounting effect.

**account.move.line** (journal item) belongs to one move. Key fields: `account_id`, `partner_id`, `product_id`, `quantity`, `price_unit`, `tax_ids`, and the signed `balance` with `debit` and `credit` derived from it. `amount_currency` holds the foreign-currency value. Reconciliation is tracked through partial and full reconcile records.

**account.payment** states: `draft`, `in_process` (posted, not yet settled), `paid`, `canceled`, `rejected`. Payments are inbound (receive) or outbound (send), and the counterparty is a customer or supplier. Each payment has a required `journal_id` (bank, cash or credit) and an `move_id` pointing to its journal entry. Posting creates that entry, and reconciliation links it to the invoice or bill.

**mail.message / mail.thread.** Chatter is a thread on any record. Messages are stored in `mail.message` and attach to a record by model and id. Followers (`mail.followers`) subscribe partners to receive those messages.

**mail.activity** is a scheduled task on a record. It has `res_model`/`res_id`, an `activity_type_id`, an assignee `user_id`, and a `date_deadline`. Its computed state is overdue, today, planned, or done. Marking it done posts a message on the record and removes the activity. Creating an activity subscribes the assignee as a follower.

**ir.sequence** generates document numbers from a `code`, with `prefix`, `suffix`, `padding` and `number_next`. The standard implementation uses a database sequence (fast, may leave gaps). The no-gap implementation is slower but gives consecutive numbers. Posted invoices rely on the gap-free option.

## Document flows

**Sales (lead to cash):**
1. **crm.lead** moves through stages and becomes an opportunity.
2. A **sale.order** is created as a quotation (`draft`/`sent`).
3. Confirming it sets state `sale` and creates **stock.picking** records with **stock.move** lines for storable products.
4. Validating the picking moves stock from `stock.quant` at the source location to the customer location.
5. Invoicing creates an **account.move** (`out_invoice`) from the order lines. Quantities depend on the product's invoicing policy: ordered or delivered.
6. Posting the invoice creates its journal items (**account.move.line**). Posting does not move stock, and validating the delivery does not post the invoice.
7. A customer **account.payment** is posted, creating its own journal entry. Reconciliation then sets the invoice to paid.

**Purchasing (order to bill):**
1. **purchase.order** is an RFQ (`draft`/`sent`), then confirmed via `button_confirm` to `purchase`. Approval may send it to `to approve` first.
2. Confirmation creates an incoming **stock.picking** (receipt). Validating it increases **stock.quant** at the stock location.
3. The vendor bill (`account.move` with `in_invoice`) is created from the PO lines and posted.
4. An outbound **account.payment** settles the bill.

## Takeaways

- Stock and accounting are separate ledgers linked by documents. Pickings change quants, and invoices change journal items. Neither automatically triggers the other, except through the order and invoicing policy.
- Each of the main documents (order, picking, invoice, payment) is a state machine with a draft state. Posting or validating is what makes the effect permanent.
- Document numbering (`ir.sequence`) and mail.thread/activity are shared infrastructure that every business model inherits.

## Unverified

- Relation details for `sale.order` to `stock.picking` and `sale.order.line` to `account.move.line` were not confirmed from the source excerpts. The source for those links lives in the `sale_stock` and `sale` modules.
- Fields for `product.template`, `uom.uom`, `res.currency`, `account.tax`, `res.users`, `res.company`, and `stock.location` state values were described from general knowledge, not fetched.
- The official Odoo developer ORM and sequence doc pages returned mostly navigation and were not usable. Facts came from the Odoo 18.0 source files.
- Some source files were truncated, so posting method names for `account.move` and the `stock.move` relations to sale and purchase lines are unconfirmed.

## Sources

- Odoo 18.0 developer docs, ORM reference: https://www.odoo.com/documentation/18.0/developer/reference/backend/orm.html
- Odoo source, `addons/sale/models/sale_order.py` (18.0): https://raw.githubusercontent.com/odoo/odoo/18.0/addons/sale/models/sale_order.py
- Odoo source, `addons/account/models/account_move.py` (18.0): https://raw.githubusercontent.com/odoo/odoo/18.0/addons/account/models/account_move.py
- Odoo source, `addons/account/models/account_move_line.py` (18.0): https://raw.githubusercontent.com/odoo/odoo/18.0/addons/account/models/account_move_line.py
- Odoo source, `addons/account/models/account_payment.py` (18.0): https://raw.githubusercontent.com/odoo/odoo/18.0/addons/account/models/account_payment.py
- Odoo source, `addons/stock/models/stock_picking.py` (18.0): https://raw.githubusercontent.com/odoo/odoo/18.0/addons/stock/models/stock_picking.py
- Odoo source, `addons/stock/models/stock_move.py` (18.0): https://raw.githubusercontent.com/odoo/odoo/18.0/addons/stock/models/stock_move.py
- Odoo source, `addons/stock/models/stock_quant.py` (18.0): https://raw.githubusercontent.com/odoo/odoo/18.0/addons/stock/models/stock_quant.py
- Odoo source, `addons/purchase/models/purchase_order.py` (18.0): https://raw.githubusercontent.com/odoo/odoo/18.0/addons/purchase/models/purchase_order.py
- Odoo source, `addons/crm/models/crm_lead.py` (18.0): https://raw.githubusercontent.com/odoo/odoo/18.0/addons/crm/models/crm_lead.py
- Odoo source, `addons/mail/models/mail_activity.py` (18.0): https://raw.githubusercontent.com/odoo/odoo/18.0/addons/mail/models/mail_activity.py
- Odoo source, `odoo/addons/base/models/ir_sequence.py` (18.0): https://raw.githubusercontent.com/odoo/odoo/18.0/odoo/addons/base/models/ir_sequence.py
