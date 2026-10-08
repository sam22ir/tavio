# P00-T08 UI kit base (shadcn, RTL-safe)
Wave 1. Parallel-safe. Read first: ARCHITECTURE.md §4, CONVENTIONS.md (UI rules).
## Files
- `components.json`: shadcn config with the ui alias set to `@/ui/primitives`
- `src/app/globals.css`: design tokens (neutral palette with a teal primary, radius 0.5rem, light and dark)
- `src/ui/primitives/*`: button, input, label, textarea, select, checkbox, dialog, sheet, dropdown-menu, table, badge, card, tabs, skeleton, sonner
- `src/ui/lib/cn.ts`
- `src/ui/primitives/button.test.tsx`
## Rules
- Run `pnpm dlx shadcn@latest add …`. You may add the radix and sonner packages it installs.
- Then **replace physical direction classes with logical ones** in every generated file: ml- → ms-, mr- → me-, pl- → ps-, pr- → pe-, left- → start-, right- → end-, text-left → text-start, and text-right → text-end. Sheet `side` must accept 'start' | 'end'.
- Buttons and inputs have a minimum height of 44px (h-11) for touch.
- Don't touch `src/app/[locale]` or `src/app/layout.tsx`.
## Verification
- `pnpm typecheck && pnpm lint && pnpm test src/ui`
- `grep -rnE '\b(ml|mr|pl|pr|left|right)-[0-9]' src/ui` returns nothing.
