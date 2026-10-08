# Wave 3: module schemas, manifests and entity metadata (P1–P3)

These are 6 parallel tasks, one per module. Each owns `src/modules/<id>/` (`schema.ts`, `manifest.ts`, `entities.ts`, `index.ts`) plus its messages namespace in all 3 languages (`messages/{fr,ar,en}/<ns>.json`).

Common rules:
- Read `docs/plan/DATA_MODEL.md` §0 and your module's sections (authoritative), then `ARCHITECTURE.md` §5, `CONVENTIONS.md`, `src/core/modules/define.ts`, `src/core/entities/types.ts`, `src/core/db/schema/tenancy.ts` (for style) and `AGENTS.md`.
- **schema.ts**: Drizzle tables exactly as in DATA_MODEL (columns, types, defaults, CHECKs, unique constraints and indexes, with company_id leading).
  - Money is `bigint({ mode: 'bigint' })`, quantities are `numeric(14,3)` and rates are `numeric(7,4)`.
  - FKs **inside your module** use `.references()`. You may import `companies` from `@/core/db/schema/tenancy` for company_id FKs.
  - **Never import another module's schema.** Cross-module FKs (e.g. contracts → partners) are left as a comment `// FK → partners.id (added by integrator)`.
  - Export the inferred `Select`/`Insert` types.
- **manifest.ts**: `export const manifest = defineModule({...})`.
  - id equals the folder name, and name is the i18n key `<ns>.module.name`.
  - permissions are `<id>.<entity>.<read|write|delete>` plus any extra listed below.
  - menus use the href, perm and order given below.
- **entities.ts**: export one `EntityDef` per main entity listed below.
  - Field `name`s are the camelCase Drizzle property names, and labels are `<ns>.fields.<name>` keys.
  - Mark sensible fields `list`, `search` and `filter`.
  - Select options come from the DATA_MODEL CHECK lists, with labels `<ns>.options.<field>.<value>`.
- **index.ts**: `export * from './schema'; export { manifest } from './manifest';`
- **messages**: `module.name`, every field and option label, the menu labels, and `empty`, `new`, `edit` and `title` keys for each main entity. Arabic must be real Arabic.
- **Don't generate migrations.**
- **Verification:** `pnpm typecheck && pnpm lint && pnpm modules:gen && pnpm drizzle-kit generate --name tmp_check`, then delete the generated tmp files from `drizzle/` and revert `drizzle/meta` changes (`git checkout drizzle/`). Don't commit `registry.generated.ts` (`git checkout src/core/modules/registry.generated.ts`); the integrator regenerates it.

## W3-A contacts (ns `contacts`)
- Tables: §3.1 partners and §3.2 partner_contacts.
- Entity: `contacts.partner`.
- Menu: `/contacts`, perm `contacts.partner.read`, order 10.
- depends: [].

## W3-B products (ns `products`)
- Tables: §3.3 product_categories, §3.4 products and §3.5 uoms (global, no company_id or RLS).
- Entities: `products.product` and `products.category`.
- Menu: `/products`, perm `products.product.read`, order 20.
- depends: [].
- Also export `UOM_SEED`, an array of the default units (unit, kg, g, m, l, box, ...) with fr/ar/en names, used by the integrator's seed SQL.

## W3-C l10n_dz (ns `l10n`)
- Tables: §3.6 currencies (global) and §3.7 taxes.
- Entity: `l10n_dz.tax`.
- Menu: `/settings/taxes`, perm `l10n_dz.tax.read`, order 90.
- depends: [].
- Also export `DZ_TAX_DEFAULTS`: TVA 19% and TVA 9% (each with a comment `// ⚠ needs accountant verification`) and the stamp-duty tiers from docs/research/05-algeria-requirements.md, as data with `validFrom`.
- Also export `CURRENCY_SEED` (DZD with 2 decimals, EUR, USD).

## W3-D chatter (ns `chatter`)
- Tables: §3.8 messages, §3.9 activity_types, §3.10 activities and §3.11 followers.
- No main entity list (the chatter is a panel, not a page).
- No menus.
- permissions: `chatter.message.read`, `chatter.message.write`, `chatter.activity.read`, `chatter.activity.write`.
- depends: [].
- Also export `ACTIVITY_TYPE_SEED` (call, meeting, todo, payment_reminder, visit).

## W3-E credit_sales (ns `credit`)
- Tables: §4.1–§4.8.
- Entities: `credit_sales.contract` and `credit_sales.payment`.
- Menus:
  - `/credit/contracts`: perm `credit_sales.contract.read`, order 30, label `credit.menu.contracts`
  - `/credit/payments`: perm `credit_sales.payment.read`, order 31
  - `/credit/overdue`: perm `credit_sales.contract.read`, order 32
- Extra permissions: `credit_sales.contract.activate`, `credit_sales.contract.cancel`, `credit_sales.payment.write`.
- depends: ['contacts', 'products', 'chatter'].
- Installment status is **derived**, never stored.

## W3-F crm (ns `crm`)
- Tables: §5.1–§5.6 (pipelines, stages, lost_reasons, leads, tags and tag_links).
- Entity: `crm.lead`, with `kanban: { groupBy: 'stageId', titleField: 'name', subtitleField: 'partnerName' }`.
- Menu: `/crm`, perm `crm.lead.read`, order 40.
- depends: ['contacts', 'chatter'].
- Also export `DEFAULT_PIPELINE`: the stages New, Qualified, Proposal, Won (is_won) and Lost (is_lost), with fr/ar/en names.
