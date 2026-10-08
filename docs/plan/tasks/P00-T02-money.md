# P00-T02 Money helpers
Wave 1. Parallel-safe. Read first: ARCHITECTURE.md §3.4.
## Files
- `src/core/money/index.ts` (new)
- `src/core/money/money.test.ts` (new)
## Implement
```ts
export type Cents = bigint;
export function parseDzd(input: string): Cents | null;
// Accepts "1234", "1234.5", "1 234,50", "1234,5 DA", with spaces or NBSP as thousands separators.
// "," or "." is the decimal mark, max 2 decimals. Returns null if the input is invalid or has more than 2 decimals.
export function formatDzd(c: Cents, locale: 'fr' | 'ar' | 'en'): string;
// Uses Intl.NumberFormat(locale + '-DZ', { style: 'currency', currency: 'DZD' }).
// Convert with whole + remainder; never do Number(cents) / 100 for large values.
export function roundHalfUp(num: bigint, den: bigint): bigint;
// Rounds half away from zero. den > 0.
export function applyRate(base: Cents, ratePercent: string): Cents;
// rate is a decimal string such as "19.0000" or "9". Result = roundHalfUp(base * rate / 100).
// Parse the rate as an integer scaled by 10^4. Floats are not allowed.
export function splitEven(total: Cents, n: number): Cents[];
// n >= 1. Each part is total / n truncated; the last part takes the remainder, so the parts sum to total.
export function sumCents(xs: readonly Cents[]): Cents;
```
## Edge cases to test
- Negative values in roundHalfUp, for example -5/10 → -1.
- applyRate(1000n, "19") = 190n, and applyRate(5n, "9") = 0n (0.45 rounds to 0).
- splitEven(1000n, 3) = [333n, 333n, 334n].
- parseDzd("12,345") = null.
- An ar format that includes Arabic digits or "د.ج" doesn't crash. Assert only that the result is a non-empty string.
## Verification
`pnpm typecheck && pnpm test src/core/money`
