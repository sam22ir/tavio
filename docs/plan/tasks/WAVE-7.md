# Wave 7: marketing website (multi-page, fr/ar/en)

## Rules for every task
- Next.js 16 App Router. Read `AGENTS.md` and `node_modules/next/dist/docs/` for metadata, sitemap and robots.
- **node_modules is a symlink, so never run `pnpm install`.** Use `./node_modules/.bin/<bin>`.
- **Design:** before writing UI, invoke the Skill tool with `skill: "design-taste-frontend"` and follow it.
  - The site must not look templated. Use bold typography, generous spacing, one accent colour consistent with the app (teal primary from `src/app/globals.css` tokens), and real product-UI mock-ups built in HTML/CSS (cards that look like Tavio screens: installment schedule, kanban, invoice). No stock photos and no external images.
  - Mobile-first, fast on cheap phones: no heavy JS, server components by default, minimal client code, CSS-only animations respecting `prefers-reduced-motion`.
  - Must look right in **Arabic RTL**: use only logical properties (ms/me/ps/pe/start/end).
- **Honesty:** no invented testimonials, customer logos, user counts or awards. Prices come from `SAAS_PLAN_SEED` (src/modules/subscriptions) and are shown as "indicative" (fr "Prix indicatifs").
- **Content:** written for Algerian SMEs. French is the main language, then real Arabic (Modern Standard Arabic, natural, not literal), then English. Mention CCP/virement/cash payment, Arabic + French, works on phones, data in Tavio cloud or on-premise.
- **Routes:** marketing pages live in `src/app/[locale]/(site)/**` and are public, with no session required and no DB access, except the header's "open app" check, which uses `getSession()` safely inside try/catch. Each page exports `generateMetadata` (title, description, alternates.languages for fr/ar/en, openGraph).
- i18n: only your own namespace files, in all 3 languages.
- **Verification:** `./node_modules/.bin/next typegen && ./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/eslint <your paths>`, and `./node_modules/.bin/next build --webpack` (it must build without DATABASE_URL: `env -u DATABASE_URL`).
- Commit with Conventional Commits and your own model's Co-Authored-By trailer. Don't push. Don't spawn sub-agents or task chips. Never print ~/.config/tavio/*.

## W7-A Site shell, design components and home page (runs first)
**Owns:** `src/app/[locale]/(site)/layout.tsx`, `src/app/[locale]/(site)/page.tsx`, `src/app/[locale]/page.tsx` (**delete it**: the home moves into (site)), `src/site/components/**`, `src/site/content/nav.ts`, `messages/*/site.json`
- **Layout:** a sticky header with logo wordmark "Tavio", nav (Features, Solutions, Pricing, On-premise, About, Contact), a language switcher, "Log in" and a primary CTA "Start free" (→ `/{locale}/signup`). When a session exists, show "Open app" (→ dashboard) instead. Mobile menu as a Sheet. A rich footer with columns (Product, Solutions, Company, Legal), plus language and WhatsApp/contact.
- **Reusable components** in `src/site/components/`, exported with typed props, for the other tasks:
  - `Section`, `Hero`, `FeatureGrid`, `FeatureRow` (alternating text + mock-up), `CtaBand`, `Faq` (details/summary accordion, no JS), `PricingCards`, `Steps`, `Badge`, `MockScreen`
  - `MockScreen` variants: `installments`, `kanban`, `invoice`, `pos`, `dashboard`. These are HTML/CSS illustrations of Tavio screens with DZD amounts and Arabic/French labels.
- **Home page:**
  - hero (value proposition for Algerian shops, credit sales + CRM + invoicing in one app, Arabic & French)
  - pain → solution
  - 6–8 module highlights linking to `/features/[slug]`
  - "built for Algeria" band (DZD, TVA, SCF, NIF/RC on invoices ⚠ verified by your accountant, CCP payments, works on cheap phones)
  - how it works (3 steps)
  - AI helpers (optional, any provider)
  - pricing teaser
  - FAQ (5 questions)
  - final CTA
- `src/site/content/nav.ts` exports the nav and footer link lists used by everyone.

## W7-B Features (after A)
**Owns:** `src/app/[locale]/(site)/features/**`, `src/site/content/features.ts`, `messages/*/site_features.json`
- `features.ts`: one entry per slug: `credit-sales`, `crm`, `sales-invoicing`, `inventory-purchases`, `accounting`, `pos`, `hr`, `projects-helpdesk`, `website-shop`, `ai`, `platform` (API, webhooks, custom fields, automation). Each has a title, tagline, 4–6 capability bullets matching what the app really does (read the module code briefly to stay accurate), a MockScreen variant and related slugs.
- `/features`: an overview grid. `/features/[slug]`: hero, FeatureRows, capabilities list, related modules and CTA. Use `generateStaticParams` for all slugs × locales and `notFound()` for unknown slugs.

## W7-C Pricing, solutions and on-premise (after A)
**Owns:** `src/app/[locale]/(site)/pricing/**`, `src/app/[locale]/(site)/solutions/**`, `src/app/[locale]/(site)/on-premise/**`, `src/site/content/solutions.ts`, `messages/*/site_pricing.json`
- **Pricing:** plans from `SAAS_PLAN_SEED` with per-user DZD price, user limits and included modules. A monthly vs yearly toggle (CSS-only or tiny client), with yearly at -2 months marked indicative. A comparison table, payment methods (CCP, virement, cash), a pricing FAQ, and "indicative prices" notes.
- **Solutions** `/solutions/[slug]`: `electromenager-credit` (appliance and furniture shops selling on installments), `car-dealers`, `clinics`, `training-centers`, `retail-pos`. Each has the problem, how Tavio solves it (which modules), a MockScreen and a CTA. Plus a `/solutions` index.
- **On-premise:** for companies that must keep data in Algeria (Law 18-07 ⚠ legal review). Covers Docker install, backups and restore, what's included, and the support offer. Contact CTA.

## W7-D About, contact, FAQ, legal (after A)
**Owns:** `src/app/[locale]/(site)/about/**`, `contact/**`, `faq/**`, `legal/**`, `src/site/contact/**` (server action), `messages/*/site_company.json`
- **About:** mission (a modern Algerian alternative to heavy ERPs), principles (Arabic + French, simple, fair pricing in DZD, your data is yours) and the roadmap direction. No fake team photos or names.
- **Contact:**
  - Form fields: name, company, phone, email, wilaya, message, plus a honeypot field.
  - The server action validates with zod and sends an email through `sendEmail` (`@/core/adapters/email`) to env `CONTACT_EMAIL`, falling back to `EMAIL_FROM`.
  - Naive rate limiting: max 3 per IP per hour, kept in memory per isolate (acceptable).
  - Success and error states.
  - Plus a WhatsApp button from env `NEXT_PUBLIC_CONTACT_WHATSAPP`; hide it if unset.
- **FAQ:** about 15 questions grouped (product, pricing and payment, data and security, on-premise, AI), using the `Faq` component.
- **Legal:** `/legal/privacy` (Law 18-07: data collected, purposes, storage location (EU cloud, Paris) or on-premise, rights, contact; marked "⚠ to be reviewed by a lawyer"), `/legal/terms` (same ⚠). No invented company registration numbers: use placeholders like `[NIF à compléter]`.

## W7-E SEO and polish (after A)
**Owns:** `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/[locale]/(site)/opengraph-image.tsx` (generated OG image with "Tavio" plus the tagline; check Next 16 docs and Workers compatibility, and skip if `next/og` doesn't work on Workers, using a static SVG in `public/` instead), `public/favicon.svg`, `src/app/icon.svg` (simple T mark in teal), `src/site/seo.ts` (helper building metadata + hreflang alternates)
- The sitemap lists all marketing routes for fr/ar/en with alternates (import slugs from `src/site/content/features.ts` and `solutions.ts` **if present**; otherwise hard-code the slug lists from WAVE-7.md).
- robots allows everything except `/api/`, the app routes (`/*/dashboard`, `/*/settings`, …), `/*/invite/`, and `/*/shop/` checkout.
- `metadataBase` from env `NEXT_PUBLIC_SITE_URL`, default `https://tavio.nafaa-store.workers.dev`.
