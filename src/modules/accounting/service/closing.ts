// Pure closing math: the result entry (classes 6 and 7 into account 12) and the opening entry (classes 1 to 5).
// No DB access, so these are unit tested. ⚠ Needs accountant verification: result account 12 and the AN layout.
import type { DraftLine } from './posting';

export const RESULT_ACCOUNT = '12';
const ZERO = BigInt(0);

export interface Balance {
  code: string;
  debitCents: bigint;
  creditCents: bigint;
}

const classOf = (code: string): number => Number(code[0]);

/**
 * Result entry for a closed year. `balances` are the year's movements (or cumulative balances, classes 6 and 7 only matter).
 * Each class 6/7 account is zeroed on its natural side, and the net result goes to account 12:
 * credit when profit, debit when loss. The lines always balance.
 */
export function buildResultLines(balances: readonly Balance[]): DraftLine[] {
  const lines: DraftLine[] = [];
  let profit = ZERO;
  for (const b of balances) {
    const cls = classOf(b.code);
    if (cls !== 6 && cls !== 7) continue;
    const net = b.debitCents - b.creditCents;
    if (net === ZERO) continue;
    profit -= net;
    lines.push({
      accountCode: b.code,
      debitCents: net < ZERO ? -net : ZERO,
      creditCents: net > ZERO ? net : ZERO,
    });
  }
  if (lines.length === 0) return [];
  lines.push({
    accountCode: RESULT_ACCOUNT,
    debitCents: profit < ZERO ? -profit : ZERO,
    creditCents: profit > ZERO ? profit : ZERO,
  });
  return lines;
}

/** Balances after applying the result lines. Used to derive the opening entry from the closing balances. */
export function applyLines(balances: readonly Balance[], lines: readonly DraftLine[]): Balance[] {
  const map = new Map<string, Balance>();
  for (const b of balances) map.set(b.code, { ...b });
  for (const l of lines) {
    const cur = map.get(l.accountCode) ?? { code: l.accountCode, debitCents: ZERO, creditCents: ZERO };
    map.set(l.accountCode, {
      code: l.accountCode,
      debitCents: cur.debitCents + l.debitCents,
      creditCents: cur.creditCents + l.creditCents,
    });
  }
  return [...map.values()];
}

/**
 * Opening entry for the next year: one line per account of classes 1 to 5 with a non-zero closing balance,
 * on its natural side. Classes 6 and 7 are excluded because they are closed into account 12.
 */
export function buildOpeningLines(closingBalances: readonly Balance[]): DraftLine[] {
  const lines: DraftLine[] = [];
  for (const b of closingBalances) {
    const cls = classOf(b.code);
    if (cls < 1 || cls > 5) continue;
    const net = b.debitCents - b.creditCents;
    if (net === ZERO) continue;
    lines.push({
      accountCode: b.code,
      debitCents: net > ZERO ? net : ZERO,
      creditCents: net < ZERO ? -net : ZERO,
    });
  }
  return lines;
}

/** Sums debit and credit over a set of lines. Returns the difference (zero when balanced). */
export function imbalance(lines: readonly DraftLine[]): bigint {
  let d = ZERO;
  let c = ZERO;
  for (const l of lines) {
    d += l.debitCents;
    c += l.creditCents;
  }
  return d - c;
}
