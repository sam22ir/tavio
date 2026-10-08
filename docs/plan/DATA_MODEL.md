# Tavio Data Model

Status: draft for P0 to P3, outline for P4 to P6 (2026-10-08). Authority: `docs/plan/ARCHITECTURE.md`. Inputs: `docs/research/00`, `02`, `05`.
**(guess)** marks decisions the inputs did not settle. **(verify)** marks items for an accountant or lawyer.

## 0. Conventions

### 0.1 Common columns (every table)
| Column | Type | Rule |
|---|---|---|
| `id` | `uuid` | primary key, `default gen_random_uuid()` |
| `created_at` | `timestamptz` | not null, `default now()` |
| `updated_at` | `timestamptz` | not null, `default now()`, set by the service layer on every update |
| `created_by` | `uuid` | references `users.id`, null for system or seed rows and for self-signup |

Append-only tables keep `updated_at` equal to `created_at` (trigger).

### 0.2 Tenant tables

A tenant table has `company_id uuid not null references companies(id)` and every index starts with `company_id`. RLS is `ENABLE` and `FORCE`, with one policy `tenant_isolation` (`USING` and `WITH CHECK`) on `company_id = current_setting('app.company_id', true)::uuid`, set by `withTenant()` with `SET LOCAL`. The app role `tavio_app` has no `BYPASSRLS` and does not own tables. RLS covers isolation only; role permissions are checked in the service layer.

Global reference tables (`uoms`, `currencies`, and the `wilayas` seed in `l10n_dz`) have no `company_id`. Tenants can read them. Only migrations write them. **(guess)**

### 0.3 Types

- Money: `bigint` named `*_cents`, in centimes (DZD x 100). Never `numeric` or `float` for money. Rounding happens in `core/money` only.
- Quantities: `numeric(14,3)`.
- Rates (VAT, markup): `numeric(7,4)` as a percentage, for example `19.0000`. **(guess)**
- Phone: text, stored in E.164 (`+213...`).
- Dates: `date` for business dates (due_date, start_date). `timestamptz` for events.
- Enums: `text` with a `CHECK` list. No Postgres `ENUM` types, so migrations stay simple.
- Document state columns: `text` with a listed `CHECK` set. Each state machine is in section 5.

### 0.4 Modules and naming

Each table belongs to one module, named in its heading. Module IDs: `core`, `contacts`, `products`, `l10n_dz`, `chatter`, `credit_sales`, `crm`, `sales`, `inventory`, `purchase`, `accounting`. Phases: P0 core; P1 contacts, products, l10n_dz, chatter; P2 credit_sales; P3 crm; P4 sales; P5 inventory, purchase; P6 accounting. Auth tables belong to `core`. `l10n_dz` holds configuration data only.

Tables are snake_case plural. Foreign keys are `<singular>_id`. Polymorphic references are `entity text` (for example `credit_sales.contract`) plus `record_id uuid`, with no database foreign key; the service layer checks them.

## 1. Relations overview (P0 to P3)

- Tenancy: `companies` 1-* `memberships` *-1 `users`. `memberships` *-1 `roles` 1-* `role_permissions`. `companies` 1-* `company_modules`, `sequences`, `outbox`, `audit_log`, `files`.
- Partners: `partners` 1-* `partner_contacts`, `contracts`, `payments`, `client_scores`, `guarantors` (as a guarantor partner). `product_categories` 1-* `products` *-1 `uoms`. `taxes` referenced by products and lines.
- Credit sales: `contracts` 1-* `contract_lines` (-* `products`), 1-* `installments`, 1-* `guarantors`. `payments` 1-* `payment_allocations` *-1 `installments` or `contracts` (down payment). `payments` 1-1 `receipts`.
- CRM: `pipelines` 1-* `stages`, 1-* `leads`. `leads` *-1 `stages`. `leads` -> `contracts` (conversion, optional). `lost_reasons` 1-* `leads`. `tag_links` joins `tags` to any record.
- Chatter: `messages`, `activities`, `followers`, `files` attach to any record by (`entity`, `record_id`).

## 2. P0: core

### 2.1 Auth tables (better-auth standard, module `core`)

We use the standard better-auth schema with the table names set to plural through `modelName`. We do not add columns. Ids are `uuid`, set through better-auth's id generator, not its default text ids. **(guess)**

- `users`: `id`, `name`, `email` (unique, case-insensitive index on `lower(email)`), `email_verified`, `image`, `created_at`, `updated_at`. `users` is global, not a tenant table.
- `sessions`: `id`, `user_id` (FK users, cascade), `token` (unique), `expires_at`, `ip_address`, `user_agent`, `active_company_id` (added by plugin; nullable FK companies). **(guess)**
- `accounts`: `id`, `user_id` (FK users, cascade), `provider_id`, `account_id`, `password` (hashed), tokens and expiry columns. Unique (`provider_id`, `account_id`).
- `verifications`: `id`, `identifier`, `value`, `expires_at`. Index on `identifier`.

### 2.2 companies

Module: core. Tenant root. Not a tenant table itself (no `company_id`, RLS is applied through memberships).

Common columns: yes.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at | timestamptz | no | |
| updated_at | timestamptz | no | |
| created_by | uuid | yes | user who created the company |
| legal_name | text | no | |
| display_name | text | no | |
| nif | text | yes | tax id (DGI). Format checked in service |
| nis | text | yes | statistical id (ONS) |
| rc | text | yes | trade register (CNRC) |
| ai | text | yes | article d'imposition. Shown on invoices only if confirmed (verify) |
| address | text | yes | |
| wilaya_code | text | yes | references `wilayas` seed, `'01'` to `'58'` |
| commune | text | yes | |
| phone | text | yes | E.164 |
| email | text | yes | |
| logo_file_id | uuid | yes | FK files |
| default_locale | text | no | `fr`, `ar` or `en`. default `fr` |
| timezone | text | no | default `Africa/Algiers` |
| currency_code | text | no | default `DZD`. FK-style reference to currencies.code |
| fiscal_year_start_month | smallint | no | 1 to 12, default 1 |
| plan | text | no | `onprem`, `saas_starter`, `saas_pro`. default `saas_starter` |
| status | text | no | `active`, `suspended`, `closed`. default `active` |

- Indexes: `(status)`.
- Unique: `(nif)` where `nif` is not null. `(rc)` where `rc` is not null.
- Checks: `status` in listed set; `default_locale` in listed set; `fiscal_year_start_month` between 1 and 12.

### 2.3 memberships

Module: core. Tenant table. Links a user to a company with one role.

Common columns: yes, plus `company_id`.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | FK companies. RLS |
| user_id | uuid | no | FK users |
| role_id | uuid | no | FK roles (same company) |
| status | text | no | `invited`, `active`, `suspended`, `left`. default `invited` |
| invited_email | text | yes | set while invited |
| invite_token_hash | text | yes | hashed, cleared on accept |
| invite_expires_at | timestamptz | yes | |
| joined_at | timestamptz | yes | |
| record_scope | text | no | `company` or `own`. default `company`. Default record rule for staff **(guess)** |

- Indexes: `(company_id, status)`, `(user_id)`, `(company_id, role_id)`.
- Unique: `(company_id, user_id)`. One membership per user per company.
- Checks: `status` and `record_scope` in listed sets.

### 2.4 roles

Module: core. Tenant table.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| key | text | no | `owner`, `admin`, `manager`, `staff`, or custom slug |
| name | text | no | display name, may be translated later |
| is_system | boolean | no | true for the four seeded roles. Cannot be deleted or renamed |
| description | text | yes | |

- Indexes: `(company_id)`.
- Unique: `(company_id, key)`.

### 2.5 role_permissions

Module: core. Tenant table.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS. Denormalized from roles for RLS |
| role_id | uuid | no | FK roles, cascade |
| permission | text | no | string like `crm.lead.write`. Must exist in the permission registry (service check) |

- Indexes: `(company_id, role_id)`.
- Unique: `(role_id, permission)`.

### 2.6 company_modules

Module: core. Tenant table. Enables modules per company.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common. `created_by` is the user who enabled it |
| company_id | uuid | no | RLS |
| module_id | text | no | matches manifest `id`, for example `credit_sales` |
| version | text | no | module version at enable time |
| enabled | boolean | no | default true |
| enabled_at | timestamptz | yes | |
| disabled_at | timestamptz | yes | |

- Indexes: `(company_id, enabled)`.
- Unique: `(company_id, module_id)`.

### 2.7 audit_log

Module: core. Tenant table. Append-only.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common. `created_by` = actor. `updated_at` = `created_at` |
| company_id | uuid | no | RLS |
| actor_user_id | uuid | yes | null for system and jobs |
| actor_type | text | no | `user`, `system`, `job`, `api_key` |
| action | text | no | `create`, `update`, `delete`, `post`, `cancel`, `login`, and so on |
| entity | text | no | module entity name, for example `credit_sales.contract` |
| record_id | uuid | yes | null for actions without a record |
| changes | jsonb | yes | `{field: [before, after]}` for updates |
| request_id | text | yes | for tracing |
| ip | inet | yes | |
| user_agent | text | yes | |

- Indexes: `(company_id, entity, record_id, created_at)`, `(company_id, actor_user_id, created_at)`, `(company_id, created_at)`.
- Trigger rejects UPDATE and DELETE for all roles except the migration owner. Retention period is a verify item (6 vs 10 years, see research 05, section 11).

### 2.8 sequences

Module: core. Tenant table. Gap-free numbering.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| code | text | no | `contract`, `receipt`, `invoice`, `credit_note`, `lead`, `quote`, `order`, `picking`, `po`, `journal_<code>` |
| prefix | text | no | default `''`. Can include a year token, for example `FAC-{YYYY}-` |
| padding | smallint | no | default 5 |
| next_number | bigint | no | default 1. The next number to hand out |
| reset_yearly | boolean | no | default false. Reset `next_number` each fiscal year **(guess)** |
| fiscal_year | smallint | yes | last year the counter was reset for |

- Indexes: `(company_id)`.
- Unique: `(company_id, code)`.
- Use: service `nextNumber(tx, companyId, code)` runs `SELECT ... FOR UPDATE`, increments `next_number` and returns the formatted value. Because the row is in the same transaction as the document, a rollback also rolls back the increment, so no gaps are left.
- Gap-free rule applies to `receipts` and `invoices`. Other codes may use the same path.

### 2.9 outbox

Module: core. Tenant table. Transactional outbox.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS. The drain job runs as owner to read across tenants **(guess)** |
| event_type | text | no | for example `credit_sales.payment.recorded` |
| payload | jsonb | no | |
| status | text | no | `pending`, `processing`, `done`, `failed`. default `pending` |
| attempts | integer | no | default 0 |
| available_at | timestamptz | no | default now(). Retry backoff |
| locked_until | timestamptz | yes | lease for a worker |
| processed_at | timestamptz | yes | |
| last_error | text | yes | |

- Indexes: partial `(available_at)` where `status in ('pending', 'failed')`. `(company_id, status)`.

### 2.10 files

Module: core. Tenant table. Metadata for objects in R2 or MinIO.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common. `created_by` = uploader |
| company_id | uuid | no | RLS |
| storage_key | text | no | object key in the private bucket. Never a public URL |
| bucket | text | no | `tavio-files` or `tavio-id-photos` (encrypted) |
| original_name | text | yes | |
| mime_type | text | no | |
| size_bytes | bigint | no | byte count, not money |
| sha256 | text | no | |
| kind | text | no | `id_photo`, `contract_pdf`, `receipt_pdf`, `attachment`, `logo`, `other` |
| entity | text | yes | owning record entity |
| record_id | uuid | yes | owning record |
| encrypted | boolean | no | true for `id_photo`. Default false |
| deleted_at | timestamptz | yes | soft delete. Hard delete only by retention job |

- Indexes: `(company_id, entity, record_id)`, `(company_id, kind)`.
- Unique: `(company_id, storage_key)`.
- National ID photos are optional (research 05 and ARCHITECTURE section 3.2). Encrypted at rest.

## 3. P1: contacts, products, l10n_dz, chatter

### 3.1 partners (module: contacts)

One table for customers, suppliers and prospects. Flags decide the role. Individuals and companies share the table.

Common columns: yes, plus `company_id`. RLS: yes.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| kind | text | no | `individual` or `company` |
| is_customer | boolean | no | default false |
| is_supplier | boolean | no | default false |
| is_prospect | boolean | no | default false. Set by CRM leads **(guess)** |
| active | boolean | no | default true. Archive instead of delete |
| display_name | text | no | computed on save: company name, or first + last name |
| first_name | text | yes | required for `individual` (check) |
| last_name | text | yes | required for `individual` (check) |
| company_name | text | yes | required for `company` (check) |
| nif | text | yes | tax id |
| nis | text | yes | statistical id |
| rc | text | yes | trade register. For companies |
| ai | text | yes | article d'imposition (verify) |
| national_id | text | yes | ID card or passport number. Encrypted at app level (AES-GCM, key from env). Plain value never logged |
| national_id_hash | text | yes | HMAC-SHA256 of normalized national_id. Used for uniqueness and lookup |
| phone | text | yes | E.164 |
| phone_alt | text | yes | E.164 |
| email | text | yes | |
| address | text | yes | |
| wilaya_code | text | yes | `'01'` to `'58'`, from `wilayas` seed (l10n_dz) |
| commune | text | yes | free text in P1. Seeded list later |
| employer | text | yes | used by credit scoring (P2) |
| monthly_income_cents | bigint | yes | P2 scoring input. Must be >= 0 |
| salesperson_id | uuid | yes | FK users. Owner of the relationship |
| notes | text | yes | |
| custom | jsonb | no | default `'{}'`. Reserved for P8 custom fields |

- Indexes: `(company_id, active)`, `(company_id, display_name)`, `(company_id, phone)`, `(company_id, is_customer)` partial where `is_customer`, `(company_id, salesperson_id)`.
- Unique: `(company_id, nif)` where `nif` is not null. `(company_id, rc)` where `rc` is not null. `(company_id, nis)` where `nis` is not null. `(company_id, national_id_hash)` where not null.
- Checks: `kind` in list. At least one of `is_customer`, `is_supplier`, `is_prospect` true. Name fields per kind. `monthly_income_cents >= 0`.

### 3.2 partner_contacts (module: contacts)

Persons inside a company partner (buyer, accountant, and so on).

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| partner_id | uuid | no | FK partners, cascade |
| name | text | no | |
| job_title | text | yes | |
| phone | text | yes | E.164 |
| email | text | yes | |
| is_primary | boolean | no | default false |

- Indexes: `(company_id, partner_id)`.
- Unique: `(partner_id)` where `is_primary` is true (one primary per partner).

### 3.3 product_categories (module: products)
| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| parent_id | uuid | yes | FK product_categories (self). Null for roots |
| name | text | no | |
| code | text | yes | short code for labels |

- Indexes: `(company_id, parent_id)`.
- Unique: `(company_id, name)`. `(company_id, code)` where `code` is not null.

### 3.4 products (module: products)

Tenant table. Stock on hand is not stored here; it lives in `quants` (P5).

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| sku | text | yes | internal reference |
| name | text | no | French or default name |
| name_ar | text | yes | Arabic name |
| category_id | uuid | yes | FK product_categories |
| kind | text | no | `goods` or `service` |
| uom_id | uuid | no | FK uoms |
| sale_price_cents | bigint | no | >= 0. Tax excluded |
| cost_cents | bigint | no | >= 0 |
| default_tax_id | uuid | yes | FK taxes, sale scope |
| track_stock | boolean | no | default false. Goods only |
| barcode | text | yes | |
| description | text | yes | |
| active | boolean | no | default true |

- Indexes: `(company_id, category_id)`, `(company_id, name)`, `(company_id, active)`.
- Unique: `(company_id, sku)` where `sku` is not null. `(company_id, barcode)` where `barcode` is not null.
- Checks: `kind` in list. `sale_price_cents >= 0`. `cost_cents >= 0`.

### 3.5 uoms (module: products, global reference)

No `company_id`. Global read, migration-only write. See section 0.2.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at | timestamptz | no | common (no `created_by`, seed data) |
| code | text | no | `piece`, `kg`, `g`, `m`, `m2`, `l`, `box`, and so on |
| name_fr | text | no | |
| name_ar | text | yes | |
| name_en | text | yes | |
| category | text | no | `unit`, `weight`, `length`, `area`, `volume`, `time` |
| factor_to_ref | numeric(20,10) | no | conversion to category reference. Reference unit has 1 |
| is_reference | boolean | no | one per category |
| active | boolean | no | default true |

- Indexes: `(category)`.
- Unique: `(code)`. Partial unique `(category)` where `is_reference`.

### 3.6 currencies (module: l10n_dz, global reference)

No `company_id`. DZD is the base. Other currencies are kept for import and FX later (P6).

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at | timestamptz | no | common |
| code | char(3) | no | ISO 4217. `DZD`, `EUR`, `USD` |
| name | text | no | |
| symbol | text | no | `DA` for DZD |
| decimals | smallint | no | 2 for DZD |
| active | boolean | no | default true |

- Unique: `(code)`.

### 3.7 taxes (module: l10n_dz)

Tenant table. Copied from the `l10n_dz` seed when a company is created, then editable by the company.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| code | text | no | `TVA19`, `TVA9`, `TVA0`, `EXO`, and so on |
| name | text | no | |
| kind | text | no | `vat`, `stamp`, `other`. Only `vat` in P1 |
| rate | numeric(7,4) | no | percent. `19.0000` for 19%. Must be >= 0 |
| scope | text | no | `sale`, `purchase`, `both` |
| valid_from | date | no | first day this rate applies |
| valid_to | date | yes | last day, inclusive. Null = open |
| active | boolean | no | default true |
| legal_ref | text | yes | citation of the source law. Verify |
| is_default_sale | boolean | no | default false |
| is_default_purchase | boolean | no | default false |

- Indexes: `(company_id, code, valid_from)`, `(company_id, scope, active)`.
- Unique: `(company_id, code, valid_from)`.
- Exclusion constraint: no two rows with the same `(company_id, code)` may have overlapping date ranges `[valid_from, valid_to]` (requires `btree_gist`). This is what makes rate changes safe. **(guess)** on the mechanism.
- Checks: `valid_to` is null or `>= valid_from`. `rate >= 0`. `kind` and `scope` in list.
- Rule for price lines: the rate is taken at the document date, not at print time. Tax amount is stored on the line (`tax_cents`), so later rate changes do not rewrite history.
- Rates and rules are configuration (research 05, sections 2 and 4). Every value needs accountant verification.

### 3.8 messages (module: chatter)

Tenant table. Chatter thread entries on any record.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common. `created_by` = author, null for system |
| company_id | uuid | no | RLS |
| entity | text | no | module entity name |
| record_id | uuid | no | |
| type | text | no | `comment`, `note`, `system` |
| body | text | yes | markdown-lite, sanitized. Null for pure tracking rows |
| tracking | jsonb | yes | `{field: [before, after]}` for `system` rows |
| is_internal | boolean | no | default false. Notes are internal |
| edited_at | timestamptz | yes | |

- Indexes: `(company_id, entity, record_id, created_at desc)`.
- Tracked fields are declared per entity metadata. A change to a tracked field creates a `system` row in the same transaction.
- Append-only except `body` for the author within a time window **(guess)**.

### 3.9 activity_types (module: chatter)
| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| name | text | no | `Call`, `WhatsApp`, `Visit`, `Reminder`, `Other` |
| entity | text | yes | null = usable on all entities |
| default_days | integer | no | default 0. Due date offset from creation |
| icon | text | yes | icon key |
| active | boolean | no | default true |

- Indexes: `(company_id, entity)`.
- Unique: `(company_id, name, entity)`. Nulls compared with `nulls not distinct` **(guess)**.

### 3.10 activities (module: chatter)

Scheduled tasks on a record (call a client, send a reminder).

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| entity | text | no | |
| record_id | uuid | no | |
| activity_type_id | uuid | no | FK activity_types |
| assignee_id | uuid | no | FK users |
| summary | text | no | |
| note | text | yes | |
| due_date | date | no | |
| done_at | timestamptz | yes | set when completed |
| done_by | uuid | yes | FK users |
| done_note | text | yes | |

- Derived state (not stored): `done` if `done_at` is set. Else `overdue` if `due_date < today`. `today` if `due_date = today`. Else `planned`.
- Indexes: partial `(company_id, assignee_id, due_date)` where `done_at is null`. `(company_id, entity, record_id)`.

### 3.11 followers (module: chatter)
| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| entity | text | no | |
| record_id | uuid | no | |
| user_id | uuid | yes | FK users. Exactly one of user_id and partner_id |
| partner_id | uuid | yes | FK partners. Exactly one of user_id and partner_id |

- Indexes: `(company_id, entity, record_id)`.
- Unique: `(company_id, entity, record_id, user_id)` where `user_id` is not null. `(company_id, entity, record_id, partner_id)` where `partner_id` is not null.
- Check: exactly one of `user_id`, `partner_id` is not null.

### 3.12 custom_field_defs (module: core, placeholder for P8)

Only the shape is set now. No UI until P8. Records get a `custom jsonb` column (see `partners.custom`).

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| entity | text | no | |
| key | text | no | snake_case, stable. Used as the JSON key |
| label_key | text | no | i18n key |
| field_type | text | no | `text`, `number`, `date`, `select`, `boolean`. Set grows later |
| options | jsonb | yes | for `select` |
| required | boolean | no | default false |
| position | integer | no | display order |
| active | boolean | no | default true |

- Indexes: `(company_id, entity, position)`.
- Unique: `(company_id, entity, key)`.

## 4. P2: credit sales

Module: credit_sales. Money rules: section 0.3. Schedule rule comes from the existing app (`src/lib/sales/schedule.ts`): financed amount = total minus down payment. Each installment is `trunc(financed / n)`. The last installment takes the remainder. Months step forward with end-of-month clamping. Weekly uses 7-day steps. The service runs this rule and tests it (the old app had no tests).

### 4.1 contracts

Tenant table. A credit sale: a partner buys products, pays a down payment and repays in installments.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common. `created_by` = seller |
| company_id | uuid | no | RLS |
| reference | text | no | from `sequences` code `contract`, for example `CTR-00001` |
| partner_id | uuid | no | FK partners. Must have `is_customer` (service check) |
| lead_id | uuid | yes | FK leads. Set on conversion |
| state | text | no | `draft`, `active`, `completed`, `cancelled`, `defaulted`. default `draft` |
| salesperson_id | uuid | yes | FK users |
| start_date | date | no | first period starts here |
| frequency | text | no | `monthly`, `weekly` |
| installments_count | integer | no | > 0. Upper limit set by config (for example 60) **(guess)** |
| cash_price_cents | bigint | no | sum of `contract_lines.line_total_cents`. >= 0 |
| markup_rate | numeric(7,4) | no | percent applied to `cash_price_cents`. >= 0. Default 0 **(guess)** |
| markup_cents | bigint | no | computed once at confirmation, rounded by `core/money`. >= 0 |
| total_cents | bigint | no | `cash_price_cents + markup_cents` |
| down_payment_cents | bigint | no | >= 0 |
| financed_cents | bigint | no | `total_cents - down_payment_cents`. >= 0 |
| down_payment_paid_cents | bigint | no | sum of allocations to the contract. default 0 |
| confirmed_at | timestamptz | yes | set on draft to active |
| completed_at | timestamptz | yes | |
| cancelled_at | timestamptz | yes | |
| cancel_reason | text | yes | required when cancelled |
| defaulted_at | timestamptz | yes | |
| notes | text | yes | |
| pdf_file_id | uuid | yes | FK files. Contract PDF (P2 output) |

- Indexes: `(company_id, state)`, `(company_id, partner_id)`, `(company_id, start_date)`, `(company_id, salesperson_id)`.
- Unique: `(company_id, reference)`.
- Checks: `state`, `frequency` in lists. `down_payment_cents <= total_cents`. `total_cents = cash_price_cents + markup_cents`. `financed_cents = total_cents - down_payment_cents`. `installments_count > 0`. `cancelled_at` required when `state = 'cancelled'`.
- Contract terms (effective annual rate, withdrawal period, early repayment) are not in the inputs. Verify before launch (research 05, section 12).

### 4.2 contract_lines
| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS. Copied from contract |
| contract_id | uuid | no | FK contracts, cascade |
| line_no | integer | no | 1-based |
| product_id | uuid | yes | FK products. Null for free-text lines |
| description | text | no | copied from product at creation, editable while draft |
| quantity | numeric(14,3) | no | > 0 |
| uom_id | uuid | yes | FK uoms |
| unit_price_cents | bigint | no | >= 0 |
| line_total_cents | bigint | no | `round(quantity * unit_price_cents)`, rounded by `core/money` |
| tax_id | uuid | yes | FK taxes. Rate read at contract date |
| tax_cents | bigint | no | default 0 |

- Indexes: `(company_id, product_id)`, `(contract_id)`.
- Unique: `(contract_id, line_no)`.

### 4.3 installments

Tenant table. One row per scheduled payment. Status is not stored.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| contract_id | uuid | no | FK contracts, cascade |
| seq | integer | no | 1 to `installments_count` |
| due_date | date | no | |
| amount_cents | bigint | no | > 0. Last row takes the remainder |
| paid_cents | bigint | no | default 0. Maintained from allocations. 0 <= paid <= amount |
| last_paid_at | timestamptz | yes | |

Derived status (computed in queries and views, never stored):

| status | rule |
|---|---|
| `paid` | `paid_cents = amount_cents` |
| `partial` | `0 < paid_cents < amount_cents` and `due_date >= today` |
| `late` | `paid_cents < amount_cents` and `due_date < today`. Covers partial and unpaid overdue rows |
| `upcoming` | `paid_cents = 0` and `due_date >= today` |

The old app stored `late` and never updated it. Do not repeat that.

- Indexes: `(company_id, due_date)` partial where `paid_cents < amount_cents` (overdue and upcoming lists). `(company_id, contract_id)`.
- Unique: `(contract_id, seq)`.
- Checks: `seq >= 1`. `amount_cents > 0`. `0 <= paid_cents <= amount_cents`.

### 4.4 payments

Tenant table. Money received from a partner. One payment can cover many installments.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common. `created_by` = cashier |
| company_id | uuid | no | RLS |
| reference | text | no | from `sequences` code `payment`, for example `PAY-00001` |
| partner_id | uuid | no | FK partners |
| state | text | no | `posted`, `reversed`. default `posted` |
| method | text | no | `cash`, `ccp`, `transfer`, `cib`, `edahabia`, `cheque` |
| amount_cents | bigint | no | > 0 |
| received_at | timestamptz | no | |
| received_by | uuid | no | FK users |
| external_ref | text | yes | CCP or transfer reference, card transaction id, or cheque number |
| bank_name | text | yes | for transfer and cheque |
| cheque_due_date | date | yes | required for `cheque` (check) |
| reversal_of_id | uuid | yes | FK payments. Set on the reversing row |
| reversed_by_id | uuid | yes | FK payments |
| note | text | yes | |

- Derived: `unallocated_cents = amount_cents - sum(payment_allocations.amount_cents)`. Not stored. Must be >= 0 (trigger).
- Indexes: `(company_id, partner_id, received_at)`, `(company_id, method, received_at)`, `(company_id, state)`.
- Unique: `(company_id, reference)`. `(company_id, method, external_ref)` where `external_ref` is not null and `state = 'posted'` **(guess)**, to block double-entry of one CCP or transfer.
- Checks: `method` and `state` in lists. `cheque_due_date` not null when `method = 'cheque'`.

**State machine (payment):**

```
posted --reverse--> reversed
```

- A posted payment is never edited or deleted (trigger). A reversal inserts a new row with `reversal_of_id`, removes the allocations, and sets the original to `reversed` with `reversed_by_id` **(guess)**.

### 4.5 payment_allocations

Tenant table. Splits a payment across installments, or onto the contract's down payment. Append-only.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common. Append-only |
| company_id | uuid | no | RLS |
| payment_id | uuid | no | FK payments |
| installment_id | uuid | yes | FK installments |
| contract_id | uuid | yes | FK contracts. Used for down payment only |
| amount_cents | bigint | no | > 0 |

- Indexes: `(company_id, payment_id)`, `(company_id, installment_id)`, `(company_id, contract_id)`.
- Unique: none. Several allocations per pair are allowed, since reversals add rows **(guess)**.
- Check: exactly one of `installment_id`, `contract_id` is not null.
- Triggers: sum of allocations for a payment <= `payments.amount_cents`. A reversal removes allocations and does not update the original row's allocations. `installments.paid_cents` and `contracts.down_payment_paid_cents` are maintained in the same transaction. Installment `paid_cents` must not exceed `amount_cents`.
- Allocation order (default): oldest due installment first, then the rest, configurable **(guess)**.

### 4.6 receipts

Tenant table. Proof of payment with a gap-free number.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| number | text | no | from `sequences` code `receipt`, gap-free |
| payment_id | uuid | no | FK payments. One receipt per payment |
| partner_id | uuid | no | FK partners. Copied from payment |
| state | text | no | `issued`, `voided`. default `issued` |
| issued_at | timestamptz | no | |
| total_cents | bigint | no | copied from payment amount. > 0 |
| pdf_file_id | uuid | yes | FK files. Rendered server-side from the HTML template (P2) |
| voided_at | timestamptz | yes | |
| void_reason | text | yes | required when voided |

- Indexes: `(company_id, issued_at)`, `(company_id, partner_id)`.
- Unique: `(company_id, number)`. `(payment_id)`.
- Checks: `state` in list. `voided_at` and `void_reason` required when `state = 'voided'`.

**State machine (receipt):**

```
issued --void--> voided
```

- A voided receipt keeps its number. Gap-free means no number is reused or removed. A correction issues a new receipt for a new payment.

### 4.7 guarantors

Tenant table. A guarantor is a `partners` row (individual). This table links it to a contract.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| contract_id | uuid | no | FK contracts, cascade |
| partner_id | uuid | no | FK partners (the guarantor) |
| relation | text | yes | free text in P2 |
| consent_at | timestamptz | no | consent to the processing of their data (Law 18-07). Required before save |
| consent_text_version | text | no | version of the notice shown |
| id_photo_file_id | uuid | yes | FK files, kind `id_photo`, optional and encrypted |
| signed_file_id | uuid | yes | FK files |

- Indexes: `(company_id, contract_id)`, `(company_id, partner_id)`.
- Unique: `(contract_id, partner_id)`.
- Consent (research 05, section 10): this is one of the mitigations for transfer and processing, pending lawyer review.

### 4.8 client_scores

Tenant table. Risk score history per partner. Append-only. The latest row is the current score.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common. `created_by` null for `rules` |
| company_id | uuid | no | RLS |
| partner_id | uuid | no | FK partners |
| contract_id | uuid | yes | FK contracts. Set when scored for a specific sale |
| score | integer | no | 0 to 100. Higher = safer **(guess)** |
| band | text | no | `A`, `B`, `C`, `D`, `E` |
| method | text | no | `rules`, `manual`, `ai_suggested`. default `rules` |
| inputs | jsonb | no | snapshot of inputs used (income, late count, and so on) |
| computed_at | timestamptz | no | |
| accepted_by | uuid | yes | FK users. Set when a human accepts an `ai_suggested` score |
| accepted_at | timestamptz | yes | |

- Indexes: `(company_id, partner_id, computed_at desc)`, `(company_id, band)`.
- Check: `score` between 0 and 100. `band` in list.
- Rule: AI suggestions (`ai_suggested`) never change a contract, a payment or a limit until `accepted_by` is set (ARCHITECTURE section 11).

## 5. P3: CRM

Module: crm.

### 5.1 pipelines

Tenant table.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| name | text | no | |
| is_default | boolean | no | default false |
| active | boolean | no | default true |
| team_user_ids | uuid[] | yes | optional team restriction **(guess)** |

- Indexes: `(company_id, active)`.
- Unique: `(company_id, name)`. Partial unique `(company_id)` where `is_default`.

### 5.2 stages

Tenant table. Ordered columns of a pipeline.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| pipeline_id | uuid | no | FK pipelines, cascade |
| name | text | no | |
| position | integer | no | order within the pipeline |
| probability | integer | no | 0 to 100. Default for new leads in this stage |
| is_won | boolean | no | default false. A won stage closes the lead as won |
| fold | boolean | no | default false. Collapsed in kanban |

- Indexes: `(company_id, pipeline_id, position)`.
- Unique: `(pipeline_id, position)`. `(pipeline_id, name)`.
- Checks: `probability` 0 to 100. At most one stage per pipeline with `is_won` true **(guess)**, enforced by partial unique index `(pipeline_id)` where `is_won`.
- Lost is not a stage. It is a `leads.status` (section 5.4).

### 5.3 lost_reasons

Tenant table.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| name | text | no | |
| active | boolean | no | default true |

- Indexes: `(company_id, active)`.
- Unique: `(company_id, name)`.

### 5.4 leads

Tenant table. One table for leads and opportunities (type field), as in Odoo's `crm.lead`. The lead converts to a contract (P2) or a quote (P4).

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| reference | text | no | from `sequences` code `lead`. Optional, set on save |
| type | text | no | `lead`, `opportunity`. Set to `opportunity` when moved past the first stage **(guess)** |
| name | text | no | short title, for example "Achat frigo, Oran" |
| partner_id | uuid | yes | FK partners. Null until identified. Created as prospect if needed |
| contact_name | text | yes | used when `partner_id` is null |
| phone | text | yes | E.164 |
| email | text | yes | |
| wilaya_code | text | yes | |
| source | text | yes | `walk_in`, `phone`, `facebook`, `instagram`, `whatsapp`, `referral`, `other` |
| pipeline_id | uuid | no | FK pipelines |
| stage_id | uuid | no | FK stages (same pipeline, check in service) |
| status | text | no | `open`, `won`, `lost`. default `open` |
| probability | integer | no | 0 to 100. Starts from stage. Can be edited |
| expected_revenue_cents | bigint | yes | >= 0 |
| expected_close_date | date | yes | |
| salesperson_id | uuid | yes | FK users |
| priority | smallint | no | 0 normal, 1 high. default 0 |
| lost_reason_id | uuid | yes | FK lost_reasons. Required when `status = 'lost'` |
| lost_at | timestamptz | yes | |
| won_at | timestamptz | yes | |
| converted_contract_id | uuid | yes | FK contracts. Set on conversion |
| converted_quote_id | uuid | yes | FK quotes (P4). Added by the P4 migration |
| active | boolean | no | default true. Archived leads are `active = false` |
| next_activity_id | uuid | yes | denormalized pointer for kanban, optional **(guess)** |

- Indexes: `(company_id, pipeline_id, stage_id)`, `(company_id, status)`, `(company_id, salesperson_id, status)`, `(company_id, partner_id)`, `(company_id, phone)`.
- Unique: `(company_id, reference)` where `reference` is not null.
- Checks: `status` and `type` in lists. `lost_reason_id` and `lost_at` required when `status = 'lost'`. `won_at` required when `status = 'won'`. `probability` 0 to 100. At most one of `converted_contract_id` and `converted_quote_id` set.

**State machine (lead):**

```
open --move to a won stage--> won
open --mark lost (needs lost_reason)--> lost
lost --reopen--> open
won  --convert (sets converted_*)--> won   (conversion does not change status)
```

- Stage moves inside `open` do not change `status`. Lost leads are kept, not deleted. Reopening clears `lost_at` and `lost_reason_id`.

### 5.5 tags

Tenant table. Free labels, used by leads (P3) and reusable later.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| name | text | no | |
| color | text | yes | hex, `#RRGGBB` |

- Indexes: `(company_id)`.
- Unique: `(company_id, name)`.

### 5.6 tag_links

Tenant table. Join table for tags on any record.

| column | type | null | notes |
|---|---|---|---|
| id | uuid | no | pk |
| created_at, updated_at, created_by | | | common |
| company_id | uuid | no | RLS |
| tag_id | uuid | no | FK tags, cascade |
| entity | text | no | for example `crm.lead` |
| record_id | uuid | no | |

- Indexes: `(company_id, entity, record_id)`, `(company_id, tag_id)`.
- Unique: `(tag_id, entity, record_id)`.

## 6. P4 to P6 outline

Table names and key columns only. Common columns and conventions apply. Full design comes when each phase starts.

- **P4 sales:** `quotes` (reference from `quote`, partner_id, lead_id, state draft/sent/accepted/expired/cancelled, valid_until). `quote_lines` (quote_id, product_id, quantity, unit_price_cents, tax_id, tax_cents, line_total_cents). `sales_orders` (reference from `order`, quote_id, state draft/confirmed/delivered/invoiced/cancelled). `sales_order_lines` (order_id, product_id, quantity, delivered_qty, invoiced_qty, unit_price_cents, tax_id). `invoices` (kind invoice/credit_note, reference from `invoice` or `credit_note`, gap-free, credit_of_id, state draft/posted/cancelled, posted_at, due_date, total_cents, tax_cents, amount_paid_cents). Posted rows are immutable; corrections are credit notes. `invoice_lines` (invoice_id, product_id, quantity, unit_price_cents, tax_id, tax_cents, line_total_cents, order_line_id).
- **P5 inventory:** `warehouses` (code, name, wilaya_code). `locations` (warehouse_id, parent_id tree, usage internal/supplier/customer/inventory/transit, full_path). `stock_pickings` (reference from `picking`, type incoming/outgoing/internal, source and dest location, partner_id, origin, state draft/waiting/ready/done/cancelled; validation = done). `stock_moves` (picking_id, product_id, uom_id, demand_qty, done_qty, locations, state, origin_entity, origin_id). `quants` (product_id, location_id, lot_no, quantity, reserved_qty; changed only by moves). Stock and accounting stay separate ledgers (research 02).
- **P5 purchase:** `purchase_orders` (reference from `po`, supplier_id, state draft/sent/to_approve/confirmed/done/cancelled). `purchase_order_lines` (po_id, product_id, quantity, received_qty, billed_qty, unit_price_cents, tax_id).
- **P6 accounting (SCF, verify all values):** `accounts` (code, name_fr, name_ar, class 1 to 9, type, reconcilable). `journals` (code, type sale/purchase/bank/cash/ccp/misc, default_account_id, sequence code `journal_<code>`). `journal_entries` (reference, journal_id, entry_date, state draft/posted/cancelled, source_entity, source_id; immutable once posted). `journal_lines` (entry_id, account_id, partner_id, debit_cents, credit_cents, tax_id, reconcile_key; entry must balance on post). `reconciliations` (debit_line_id, credit_line_id, amount_cents).

## 7. Contracts frozen in P0

Other modules may rely on the names, types and meanings below. Changing them needs approval of the core kernel.

- **Identity:** `users.id uuid`, `users.email` unique (case-insensitive). Tenant context is the Postgres setting `app.company_id`, set by `withTenant()` with `SET LOCAL`.
- **Companies:** `companies.id`, `legal_name`, `nif`, `rc`, `nis`, `ai`, `wilaya_code`, `default_locale`, `currency_code`, `status`.
- **Access:** `memberships(company_id, user_id, role_id, status)` unique on (company_id, user_id). `roles(company_id, key)` with seeded keys `owner`, `admin`, `manager`, `staff`. `role_permissions(role_id, permission)`, permission strings `<module>.<entity>.<action>`. `company_modules(company_id, module_id, enabled)`.
- **Services:** `withTenant`, `ctx = { userId, companyId, perms, tx }`, `requirePerm` and `can`, `nextNumber(tx, companyId, code)` on `sequences`, `bus.emit(ctx, event)` writing to `outbox`, `audit(ctx, {...})` writing to `audit_log`, `Result<T, AppError>` for actions.
- **Common shape:** `id uuid`, `created_at`, `updated_at`, `created_by`, `company_id uuid not null` on tenant tables. Money `*_cents bigint`. Quantities `numeric(14,3)`. Rates `numeric(7,4)`.
- **Entity names:** `<module>.<entity>` (for example `credit_sales.contract`), used by `messages`, `activities`, `followers`, `files`, `tag_links`, `audit_log`.
- **Files:** `files(id, company_id, storage_key, kind, entity, record_id)`, accessed by signed URL only.
- **Migrations:** Drizzle output in one ordered `drizzle/` folder, prefixed by module. RLS and triggers are hand-written. App role `tavio_app` has no `BYPASSRLS`.

## 8. Decisions confirmed by the architect (2026-10-08)
- better-auth is configured to use uuid ids (`advanced.database.generateId` set to uuid). Its tables keep better-auth's standard names.
- `uoms` and `currencies` are global reference tables with no `company_id` and are read-only to tenants. `taxes` are per company.
- Rates are stored as `numeric(7,4)` percent. Tax is `round_half_up(base_cents * rate / 100)` per line, through `core/money`. ⚠ The rounding rule needs accountant verification.
- The down payment is a payment allocated to the contract, not an installment.
- Markup is stored as a rate plus computed `markup_cents`, fixed when the contract is activated.
