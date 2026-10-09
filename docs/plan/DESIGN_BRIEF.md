# Tavio marketing site: design brief (approved 2026-10-09)

References: Cuby (italic serif accent, floating 3D badges, device-framed screens), Codex Pacer (two-tone headlines, screenshot + title/subline list, rounded panels on warm bg), Opero (one cinematic dark section, pill labels, integration orbit), "Virtual Superstars" (before/after connector diagram), Moonjar (warm light, highlighted word, real app screenshots), Fennec (Arabic-first, deep green, curved timeline).

## Tokens
- **Background:** warm cream `#F4F1EA`. Panels are white `#FFFFFF` with radius 28px, border `rgba(15,26,23,0.06)` and shadow `0 1px 2px rgba(15,26,23,.04), 0 12px 32px -12px rgba(15,26,23,.12)`.
- **Ink:** `#0F1A17`. Muted: `#5B6B66`.
- **Accent:** deep green `#1F5F55`, hover `#174A42`, soft `#E3EFEA`, highlight `#CFE9DD`. Danger (only "before"): `#C2410C` / soft `#FDECE3`.
- **One dark section:** bg `#0F1A17`, text `#EAF2EE`, accent `#7FD1B2`.
- **Typography:**
  - Latin headings: **Inter Tight** 700/800, tracking -0.03em, size up to 72px desktop / 40px mobile.
  - Accent word: **Instrument Serif** italic, same size, colour accent.
  - Body: Inter 400/500, 17–18px, line-height 1.6.
  - Arabic headings: **IBM Plex Sans Arabic** 700. The accent word is **Aref Ruqaa** 700 in accent green, and the body is IBM Plex Sans Arabic.
  - Load with `next/font/google` and swap by locale.
- **Pill label** above every section heading: a white pill with a 1px border, a 12px icon and 13px text.
- **Buttons:** primary is a dark ink pill (`#0F1A17`, white text, arrow icon, slight inner highlight). Secondary is a white pill with a border. Accent CTAs use green.
- **Motion:** subtle fade/translate on scroll (CSS `@keyframes` + `animation-timeline: view()` where supported, otherwise static) and floating badges with gentle `translateY` loops. All respect `prefers-reduced-motion`.

## Visual building blocks
- `DeviceFrame` (`laptop` | `phone` | `browser`): renders a real screenshot from `/screens/<name>-<locale>.png` (fallback to `-fr`), with an optional floating card overlapping a corner.
- `ConnectorDiagram`: left column of "before" cards (red ✕), a centre Tavio mark, right column of "after" cards (green ✓), joined by SVG curved connectors. RTL mirrors it.
- `ModulesOrbit`: the Tavio mark in the centre, with module chips on 2 concentric rings (CSS/SVG), all linking to `/features/[slug]`.
- `CurvedTimeline`: 3–4 steps along a hand-drawn-looking SVG path (Fennec style).
- `FloatingBadges`: 3D-ish tiles (gradient, inner highlight, soft coloured shadow) with icons for DZD, CCP, WhatsApp, invoice and TVA, placed around the hero. Hidden on small screens.
- `FeatureList`: a Codex-Pacer style list of title + subline rows with hairline dividers, next to a DeviceFrame.

## Screenshots (real app, demo company "Électroménager El Baraka, Sétif")
These files are in `public/screens/` (fr and ar variants):
- `dashboard`, `contract-detail`, `overdue`, `crm-kanban`, `invoice`, `pos`, `phone-dashboard`

## Home page flow
1. Hero: pill "Nouveau · Pensé pour l'Algérie" (New · Designed for Algeria), headline "Vos ventes à crédit, *enfin* sous contrôle." (Your credit sales, *finally* under control.) plus a subline, then a primary "Commencer gratuitement" (Start for free) and a secondary "Voir la démo" (See the demo). Visual: a laptop with `dashboard`, plus a phone with `phone-dashboard` floating, plus FloatingBadges. Use a soft green radial glow and a faint grid behind it (like Cuby).
2. Pilot band: "Programme pilote : nous accompagnons nos premiers commerces à Sétif, Alger et Oran" (Pilot program: we support our first shops in Sétif, Algiers and Oran), with a CTA "Rejoindre le pilote" (Join the pilot). **No fake logos.**
3. Before vs after: ConnectorDiagram.
4. Three feature sections, alternating (screenshot + FeatureList): credit sales and installments (`contract-detail`), overdue and WhatsApp reminders (`overdue`), invoicing and accounting (`invoice`).
5. ModulesOrbit: "Une seule application, 20 modules" (One app, 20 modules).
6. Built for Algeria: a bento grid of 6 tiles (DZD and TVA, SCF, NIF/RC on invoices ⚠, CCP and cash, Arabic and French, cheap phones).
7. **Dark section:** AI helpers (any provider) + on-premise (data in Algeria), with a `crm-kanban` or `pos` screenshot.
8. How it works: CurvedTimeline (create the company, import, sell and collect).
9. Pricing teaser (PricingCards restyled).
10. FAQ.
11. Final CTA panel in green.

## Rules
- No invented testimonials, logos or user counts. Prices are indicative.
- RTL: logical properties only. Diagrams and timelines mirror. Amounts stay LTR (`dir="ltr"` / `<bdi>`).
- Fast: images use `next/image` with explicit sizes (the PNGs from public/), lazy below the fold, priority for the hero. No heavy JS libraries.
