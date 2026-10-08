# P00-T07 i18n, locale routing and root layout
Wave 1. Parallel-safe. Read first: ARCHITECTURE.md §9, CONVENTIONS.md (UI rules). Check the current next-intl docs for Next.js 16 (it uses `proxy.ts` instead of middleware).
## Files
- `src/i18n/routing.ts`: locales ['fr', 'ar', 'en'], default 'fr', prefix 'always'
- `src/i18n/request.ts`: loads `messages/<locale>.json`
- `src/proxy.ts`: the next-intl proxy, matcher excludes /api, /_next and static files
- `src/core/i18n/dir.ts`: `export function dirFor(l: Locale): 'rtl' | 'ltr'` plus a unit test, `dir.test.ts`
- `src/app/[locale]/layout.tsx`: `<html lang dir>`, NextIntlClientProvider, imports `../globals.css`. Fonts via next/font: Inter for Latin, Noto Sans Arabic for ar.
- `src/app/[locale]/page.tsx`: a simple placeholder showing `t('core.app.name')` ("Tavio")
- Delete `src/app/layout.tsx` and `src/app/page.tsx`. Move globals.css only if the import path requires it, and don't change its contents.
- `messages/fr.json`, `messages/ar.json`, `messages/en.json`: keys `core.app.name`, `core.app.tagline`, and `core.nav.{dashboard,settings,logout}`. Arabic must be real Arabic.
## Verification
`pnpm typecheck && pnpm lint && pnpm test src/core/i18n && pnpm build`. Then `pnpm start` and `curl -s localhost:3000/ar | grep 'dir="rtl"'`.
