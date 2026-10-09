// Pure posting rules: balance check and event-to-lines mapping. No DB access, so these are unit tested.
import { err, ok, type Result } from '@/core/result';

export type Side = 'debit' | 'credit';

export interface DraftLine {
  accountCode: string;
  partnerId?: string | null;
  label?: string | null;
  debitCents: bigint;
  creditCents: bigint;
}

const ZERO = BigInt(0);

/** Every line has exactly one side > 0, and Σdebit = Σcredit. Returns the first problem as an error. */
export function checkBalanced(lines: readonly DraftLine[]): Result<{ totalCents: bigint }> {
  if (lines.length < 2) return err('VALIDATION', 'ENTRY_NEEDS_TWO_LINES');
  let debit = ZERO;
  let credit = ZERO;
  for (const line of lines) {
    if (line.debitCents < ZERO || line.creditCents < ZERO) return err('VALIDATION', 'NEGATIVE_AMOUNT');
    if ((line.debitCents > ZERO) === (line.creditCents > ZERO)) {
      return err('VALIDATION', 'LINE_NEEDS_ONE_SIDE');
    }
    debit += line.debitCents;
    credit += line.creditCents;
  }
  if (debit !== credit) return err('VALIDATION', 'ENTRY_NOT_BALANCED', { debit: debit.toString(), credit: credit.toString() });
  return ok({ totalCents: debit });
}

/** Swaps debit and credit on each line. Used by reverseEntry. */
export function invertLines(lines: readonly DraftLine[]): DraftLine[] {
  return lines.map((l) => ({ ...l, debitCents: l.creditCents, creditCents: l.debitCents }));
}

/** Adds a line on the given side, skipping zero amounts. */
function line(accountCode: string, side: Side, cents: bigint, partnerId?: string | null, label?: string): DraftLine[] {
  if (cents === ZERO) return [];
  return [
    {
      accountCode,
      partnerId: partnerId ?? null,
      label: label ?? null,
      debitCents: side === 'debit' ? cents : ZERO,
      creditCents: side === 'credit' ? cents : ZERO,
    },
  ];
}

export interface InvoiceForPosting {
  type: 'out_invoice' | 'out_refund' | 'in_invoice' | 'in_refund';
  partnerId: string;
  number: string;
  untaxedCents: bigint;
  taxCents: bigint;
  stampCents: bigint;
  totalCents: bigint;
}

/**
 * Sale: Dr 411 total / Cr 700 untaxed / Cr 4457 VAT / Cr 445 stamp.
 * Purchase: Cr 401 total / Dr 600 untaxed / Dr 4456 VAT / Dr 445 stamp.
 * Refunds (out_refund, in_refund) invert every line.
 * ⚠ Needs accountant verification: stamp duty (445) side and account choice.
 */
export function invoiceLines(inv: InvoiceForPosting): DraftLine[] {
  const isSale = inv.type === 'out_invoice' || inv.type === 'out_refund';
  const lines = isSale
    ? [
        ...line('411', 'debit', inv.totalCents, inv.partnerId, inv.number),
        ...line('700', 'credit', inv.untaxedCents, null, inv.number),
        ...line('4457', 'credit', inv.taxCents, null, inv.number),
        ...line('445', 'credit', inv.stampCents, null, inv.number),
      ]
    : [
        ...line('401', 'credit', inv.totalCents, inv.partnerId, inv.number),
        ...line('600', 'debit', inv.untaxedCents, null, inv.number),
        ...line('4456', 'debit', inv.taxCents, null, inv.number),
        ...line('445', 'debit', inv.stampCents, null, inv.number),
      ];
  const isRefund = inv.type === 'out_refund' || inv.type === 'in_refund';
  return isRefund ? invertLines(lines) : lines;
}

export interface PaymentForPosting {
  type: 'out_invoice' | 'out_refund' | 'in_invoice' | 'in_refund';
  partnerId: string;
  amountCents: bigint;
  method: string;
  reference: string;
}

/** Cash-register account for cash payments, bank for everything else. */
export function treasuryAccount(method: string): '53' | '512' {
  return method === 'cash' ? '53' : '512';
}

/**
 * Customer receipt (out_invoice): Dr 512|53 / Cr 411. Customer refund: Dr 411 / Cr 512|53.
 * Supplier payment (in_invoice): Dr 401 / Cr 512|53. Supplier refund: Cr 401 / Dr 512|53.
 */
export function paymentLines(p: PaymentForPosting): DraftLine[] {
  const treasury = treasuryAccount(p.method);
  const partnerAccount = p.type === 'out_invoice' || p.type === 'out_refund' ? '411' : '401';
  const partnerDebit = p.type === 'out_refund' || p.type === 'in_invoice';
  const partnerSide: Side = partnerDebit ? 'debit' : 'credit';
  const treasurySide: Side = partnerDebit ? 'credit' : 'debit';
  return [
    ...line(treasury, treasurySide, p.amountCents, null, p.reference),
    ...line(partnerAccount, partnerSide, p.amountCents, p.partnerId, p.reference),
  ];
}

export interface PosPaidForPosting {
  orderId: string;
  number: string;
  totalCents: bigint;
  untaxedCents: bigint;
  taxCents: bigint;
}

/** POS sale: Dr 53 total / Cr 700 untaxed / Cr 4457 VAT. */
export function posLines(p: PosPaidForPosting): DraftLine[] {
  return [
    ...line('53', 'debit', p.totalCents, null, p.number),
    ...line('700', 'credit', p.untaxedCents, null, p.number),
    ...line('4457', 'credit', p.taxCents, null, p.number),
  ];
}

/** G50 monthly VAT draft. Collected = credit − debit on 4457. Deductible = debit − credit on 4456. ⚠ Draft only. */
export function g50Summary(collectedCents: bigint, deductibleCents: bigint) {
  return {
    collectedCents,
    deductibleCents,
    netDueCents: collectedCents - deductibleCents,
    needsAccountantReview: true as const,
  };
}
