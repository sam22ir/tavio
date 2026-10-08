# ERPNext, Dolibarr, and short notes on Tryton and iDempiere

Lessons for a modular TypeScript business suite.

## ERPNext (Frappe framework)

- **Architecture:** The data model is metadata. A DocType is a JSON definition that yields a DB table (`tab` prefix), a list view, a form view, and a REST endpoint from one source. Custom Fields are stored as documents of a DocType, so they show up in forms, the API, reports, and permissions without per-layer code. Stack: Python, MariaDB/MySQL.
- **Customization ladder:** Customize Form (Custom Fields and Property Setters, no code, upgrade-safe), Client Scripts (JS), Server Scripts (restricted Python), then full custom apps.
- **Module system:** ERPNext is an app on the Frappe framework. Apps are installed per bench and per site.
- **Multi-tenancy:** Multi-site on one bench (general knowledge, not confirmed by sources). Each site has its own DB.
- **Licensing:** GPL-3.0 (general knowledge, not confirmed in this research).
- **Strengths:** Breadth of modules, a consistent API, low cost for SMBs, fast UI builds from metadata.
- **Weaknesses and complaints (Capterra 2025-2026, small sample):** Dated interface, weaker HR/payroll, upkeep burden when versions lag, slow bug-fix responsiveness reported by one contributor. Customer support rated 4.1/5, ease of use 4.5/5.
- **Pricing:** Self-host is free. Frappe Cloud figures from third parties conflict (about $5 to $10 per site per month entry tier, $40 for a dedicated server). Unverified; check the official pricing page.

## Dolibarr

- **Architecture:** PHP app with no heavy framework. Trigger and hook system lets business events run custom PHP. About 100 core modules and 1000+ add-ons (aggregator figure). REST and SOAP APIs.
- **Module system:** Modules toggle individually. Add-ons come from a marketplace.
- **Multi-tenancy:** Weak in core. Native multicompany means reinstalling. The MultiCompany add-on shares one DB with logical (not physical) isolation. Documentation is old.
- **Licensing:** GPL-3.0-or-later per README (some listings say GPL-3.0; check COPYING).
- **Strengths:** Free core, no seat limits, low resource needs, Capterra 4.5/5 from 106 users, ease of use 4.3/5.
- **Weaknesses:** Customer support 3.7/5 (weakest score). Older docs list gaps such as single currency and no payroll (dated). Little user criticism of multicompany was found.
- **Pricing:** Core free. DoliCloud managed hosting from about 9 EUR per month (vendor listing).

## Tryton (brief)

- Three-tier: Python client, Python server, PostgreSQL. Web client "sao". Module-based kernel usable beyond ERP.
- GPL-3.0-or-later. Smaller community than ERPNext.

## iDempiere (brief)

- Java, OSGi, Jetty, ZK, PostgreSQL or Oracle. Metadata-driven "Application Dictionary". Multi-tenant, multi-org, multi-currency.
- GPLv2. Descends from Compiere. Heavyweight to customize.

## Learn from

- One metadata definition driving DB schema, UI, API, and permissions (DocType model).
- Custom fields stored as data, so tenant customization is upgrade-safe.
- A layered customization ladder: config, then scripts, then code.
- Toggleable modules with add-on marketplace.
- Hook/trigger events for extension (Dolibarr).
- Clear free-core plus paid hosting or support pricing.

## Avoid

- Dated, dense UI from generic forms. Invest in design early.
- Multi-tenancy as an afterthought or add-on. Design tenant isolation into the core.
- Untracked UI customizations drifting from code. Keep config in version-controlled fixtures.
- Heavy upgrade burden and slow contribution cycles.
- Weak HR/payroll and support quality for a broad suite.

## Sources

- https://www.mintlify.com/frappe/erpnext/developers/architecture
- https://ecosire.com/blog/erpnext-customization-frappe-framework
- https://docs.frappe.io/framework/user/en/basics/doctypes
- https://dev.co/crm/open-source/dolibarr
- https://us.fitgap.com/products/dolibarr-erp-crm
- https://gappsy.com/tools/dolibarr/
- https://github.com/Dolibarr/dolibarr/wiki/Upgrade
- https://www.capterra.com/p/164441/ERPNext/reviews/
- https://www.capterra.co.uk/software/159500/dolibarr-erp-crm
- https://www.selecthub.com/erp-software/dolibarr/
- https://en.wikipedia.org/wiki/Tryton
- https://en.wikipedia.org/wiki/IDempiere
- https://ecosire.com/blog/odoo-vs-idempiere-comparison-2026
- https://ecosire.com/es/blog/erpnext-pricing-explained-2026 (pricing, conflicting; vendor with commercial interest)
