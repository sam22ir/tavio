# Odoo UX patterns to reproduce (without branding)

Scope: patterns worth rebuilding in an original React product. Each entry gives what it does, why users like it, and a design note for a shadcn/Radix + TanStack Table stack that works on cheap phones.

## 1. App switcher / home menu
- **What:** A top-level grid of installed apps; the navbar keeps the current app's menus.
- **Why users like it:** One predictable place to jump between modules.
- **Rebuild:** A Radix Dialog or DropdownMenu listing modules as a plain list with icons. Keep a "recent" list in localStorage (per-viewer convenience only).

## 2. List view
- **What:** Dense table, inline grouping headers, optional inline editing, bulk actions, pagination.
- **Why:** Scanning hundreds of records fast.
- **Rebuild:** TanStack Table with a virtualized body (TanStack Virtual), sticky header, server-side pagination and sorting. Column visibility via a Popover checklist.

## 3. Form view
- **Statusbar:** A stage bar at the top showing the record's state; clicking a stage advances it. Rebuild as a segmented row of buttons that wraps on small screens.
- **Smart buttons:** Counted links (e.g. "Invoices 3") in a button box. Rebuild as a row of Buttons with badge counts that open a filtered list.
- **Notebook tabs:** Sections of a long form. Rebuild with Radix Tabs; on phones, collapse to an accordion.

## 4. Kanban
- **Stages as columns**, cards draggable between them.
- **Folding:** Stages can be collapsed to a narrow strip; folded stages are a per-stage setting, not a per-user one.
- **Quick create:** Type a title at the bottom of a column. Rebuild with an inline input; on phones, switch to a vertical stack with stage tabs instead of horizontal scroll.

## 5. Search panel
- **Facets:** Typed search terms become removable chips; Filter, Group By, and Favorites live in one dropdown.
- **Group-by** nests in order (first group is the outer cluster).
- **Favorites** save a search and can be set as default.
- **Rebuild:** A single combobox (Radix Popover + cmdk) that renders facets as chips. Keep the query in the URL so searches are shareable and survive refresh.

## 6. Chatter
- **What:** A timeline under each record with messages, log notes (internal), automatic change tracking, scheduled activities (type, summary, assignee, due date), and followers.
- **Why:** Context lives on the record, not in email.
- **Rebuild:** A right-hand or bottom panel with three tabs (Messages, Notes, Activities). Auto-log field changes server-side. Followers as a Popover list. On phones, the chatter becomes a full-screen sheet opened from a button.

## 7. Activity view
- **What:** Calendar-like list of due activities grouped by record or by date (overdue, today, later).
- **Rebuild:** A grouped list with date buckets; avoid a heavy calendar component on low-end devices.

## 8. Pivot and graph reports
- **What:** Pivot = cross-tab of rows and columns with measures; graph = bar/line/pie from the same aggregates.
- **Why:** Ad-hoc analysis without an export.
- **Rebuild:** Server-side aggregation endpoint returning a tidy table; render the pivot as a TanStack Table with sticky headers; render charts with a lightweight library and lazy-load it so the first paint stays small.

## 9. PDF reports
- **What:** Printable documents generated from the same record (invoices, quotes).
- **Rebuild:** Generate server-side (HTML to PDF). On phones, offer "download" rather than in-browser preview.

## 10. Breadcrumbs
- **What:** Path back through record hierarchy (Module > List > Record).
- **Rebuild:** A shadcn Breadcrumb component; on narrow screens show only the parent with a back arrow.

## 11. Multi-company switcher
- **What:** Top-bar control to enable one or several companies; the active set filters all data.
- **Rebuild:** A DropdownMenu with checkboxes; store the active company set in the URL or a session header so every query is scoped consistently.

## 12. Mobile behavior
- Odoo's mobile experience relies on third-party responsive modules (sticky headers, icon-only control buttons, a view-type picker that fits the screen). Their existence suggests the core layout was not designed mobile-first.
- **Rebuild:** Design mobile-first: one column, bottom navigation, sheets instead of side panels, no hover-only actions, touch targets of at least 44px, and a data-light default (paginate, do not load whole tables).

## Common UX complaints about Odoo
- **Navigation complexity** for non-technical staff; too many menus and modules to find things.
- **Dated default look** and cluttered screens (cited by theme vendors, so treat as directional).
- **Slowness in specific cases**, notably Studio customizations and some local-install setups.
- **Implementation problems:** many critics blame poor rollout planning and customization rather than the interface alone.
- Counterpoint: some reviewers call it easy to use once set up.

## Design takeaways for a cheap-phone product
1. Keep the data-heavy views (list, pivot) paginated and server-aggregated.
2. Move secondary panels (chatter, filters, followers) into sheets on phones.
3. Ship a small first bundle; lazy-load charts and PDF preview.
4. Keep the URL as the source of truth for filters and sort.

## Sources
- Odoo documentation, Chatter (18.0/19.0): https://www.odoo.com/documentation/18.0/applications/productivity/discuss/chatter.html
- Odoo documentation, Search, filter, and group records (20.0): https://www.odoo.com/documentation/20.0/applications/essentials/search.html
- Odoo documentation, Kanban folded stages (via search results): https://github.com/odoo/documentation/pull/15164.diff
- OCA web_responsive 18.0 (Trobz): https://odoo-modules.trobz.com/oca/web/18.0/web_responsive.html
- Cybrosys, list view components in Odoo 18: https://www.cybrosys.com/blog/overview-of-list-view-components-in-odoo-18
- Cybrosys, Odoo 18 Studio kanban views: https://www.cybrosys.com/odoo/odoo-books/odoo-18-studio/kanban-views/
- Cybrosys, Odoo 17 chatter: https://cybrosys.com/odoo/odoo-books/odoo-17-development/emails/chatter
- Switch company access (Odoo 19 app listing): https://apps.odoo.com/apps/modules/19.0/switch_company_access_dh
- Cloudron forum, Odoo UX criticism: https://forum.cloudron.io/topic/1256/odoo-distributed-business-apps?page=5
- Odoo community forum, Studio slowness: https://www.odoo.com/forum/help-1/odoo-studio-slow-271940
- Ksolves case study (vendor, treat as biased): https://www.ksolves.com/case-studies/odoo/modernizing-erp-interface-with-arc-backend-theme-enterprise
