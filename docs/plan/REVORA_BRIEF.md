# Revora rebrand brief (approved 2026-10-09)

The product formerly called **Tavio** is now **Revora**, the growth platform of Revora, a business growth company in Algiers. This brief **replaces the colours, fonts and positioning** of `DESIGN_BRIEF.md`. Its layout system, components (HeroUI + custom sections), Motion animations and real screenshots stay.

## Positioning (from Revora's LinkedIn page)
- **Tagline:** "Growth Is a System." (fr: « La croissance est un système. », ar: «النمو منظومة متكاملة.»)
- **Company:** Revora is a business growth company built by professionals with hands-on experience across **Marketing, Sales and Back Office**. It helps businesses build stronger growth systems by connecting **customer acquisition, sales, operations, data and technology**.
- **Approach:** understand how the business works → identify where growth is being lost → build systems that improve performance. It's born from real market experience, not theory, and aims to be a long-term partner for businesses that want to scale, across industries.
- **Audience:** Algerian businesses of all sizes and industries (not only small shops).
- **Offer** = the **Revora platform** (all 20 modules) + **Revora growth services**:
  - audit ("where is your growth being lost?")
  - setup and configuration
  - training
  - ongoing support and optimisation
- **The 5 pillars** map to modules:
  - Acquisition: CRM, web shop, WhatsApp campaigns, lead capture
  - Sales: quotes/orders, credit sales, POS, follow-ups
  - Operations: invoicing, stock, purchases, SCF accounting, HR, helpdesk
  - Data: dashboards, KPIs, AI assistant, reports
  - Technology: API, webhooks, automation, custom fields, on-premise
- **Primary CTA:** "Demander un audit gratuit" (Request a free audit) / «اطلب تدقيقًا مجانيًا» / "Request a free audit". Secondary: "Voir la plateforme" (See the platform). Keep "Essayer gratuitement" (Try for free) where it fits, e.g. pricing.
- **Before/after wording:** **SANS REVORA / AVEC REVORA** (without / with Revora). Without: "Lent, débordé, en retard" (slow, swamped, behind). With: "Rapide, visible, en avance" (fast, visible, ahead).

## Brand tokens
- **Revora blue** `#08409D` (primary), hover `#06337E`, light `#2F6FE0`, sky accent `#A9C4FF` (used for the first headline word on blue), soft `#E8EFFC`.
- **Hero gradient:** `linear-gradient(135deg, #0B3BB5 0%, #1E5BE0 55%, #2F6FE0 100%)` with a subtle radial highlight. Use it on the hero and the big CTA panels.
- **Navy section:** `#071D4A`, text `#EAF0FF`.
- **Backgrounds:** white `#FFFFFF` and very light blue-grey `#F4F7FC`. Panels are white, radius 24px, with a soft blue-tinted shadow `0 12px 32px -12px rgba(8,64,157,.18)`.
- **Text:** ink `#0A1633`, muted `#5A6785`.
- **Danger** (only "without"): `#C2410C`. Success ✓: `#16A34A`.
- **Typography:** **IBM Plex Sans** for Latin and **IBM Plex Sans Arabic** for Arabic, everywhere (headings and body). No Montserrat, Inter, Instrument Serif or Aref Ruqaa anymore.
  - **Headlines:** Plex Sans **700**, **UPPERCASE** for the big hero and section titles, tight leading (1.0–1.05), letter-spacing -0.01em. In Arabic, use bold with no uppercase (not applicable).
  - The **first word or line of a big headline is in sky `#A9C4FF`** when on blue, or Revora blue when on white, like "RESPONSABLE / RESSOURCES HUMAINES".
  - **Body:** Plex Sans 400/500, 17px.
- **Logo:** `public/brand/revora-logo.svg` (full logo, blue), `revora-logo-white.svg` (on blue), `revora-mark.svg` (R mark, `currentColor`), `revora-mark-blue.svg`. Header: mark + "REVORA" wordmark (use the full logo SVG). **Watermark:** a huge R mark at ~6% opacity, cropped at the hero's end side (white on blue).
- **Chips:** outlined translucent pills on blue (`border rgba(255,255,255,.35)`, bg `rgba(255,255,255,.08)`) like "📍 Alger · Temps plein · 5 ans+". Pill label: a white pill with a blue dot (« ● NOUS RECRUTONS » style).
- **Motion:** keep the existing Reveal, parallax, connector draw, orbit and timeline animations, recoloured.

## Rename rules
- User-facing "Tavio" becomes "Revora" in every language. That covers app UI, emails, PDFs, metadata, the sitemap, OG and the manifest.
- **Internal identifiers stay** (package name, DB, Worker name, env vars, the `tavio_app` role, cookie names, repo). Never rename the DB role or cookies, because that would break live sessions.
- Demo data stays "Électroménager El Baraka, Sétif".
