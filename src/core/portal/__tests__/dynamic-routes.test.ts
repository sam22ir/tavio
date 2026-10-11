import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The root [locale] layout has generateStaticParams, so a session-reading layout must opt out of
// prerendering. A prerendered portal page never sees the cookie and fails on Workers.
describe('session-reading layouts are dynamic', () => {
  it.each(['src/app/[locale]/portal/layout.tsx', 'src/app/[locale]/(app)/layout.tsx'])('%s', (file) => {
    const src = readFileSync(join(process.cwd(), file), 'utf8');
    expect(src).toMatch(/export const dynamic = 'force-dynamic'/);
  });
});
