// Pure posting rules: balance check and event-to-lines mapping. No DB access, so these are unit tested.
import type { StockMoveKind } from '@/core/events/catalog';
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
  /** Purchases only: retenue à la source withheld from the supplier, credited to withholdingAccountCode (447 by default). */
  withholdingCents?: bigint;
  withholdingAccountCode?: string;
  /**
   * Purchases only: the untaxed part of the bill for stock-tracked goods. With perpetual inventory it is
   * debited to 380 (cleared by the receipt's Dr 30 / Cr 380), and the rest stays on 600. Defaults to 0.
   */
  stockedUntaxedCents?: bigint;
}

/**
 * Sale: Dr 411 total / Cr 700 untaxed / Cr 4457 VAT / Cr 445 stamp.
 * Purchase: Cr 401 net payable / Cr 447 withholding / Dr 380 stocked goods / Dr 600 rest of untaxed / Dr 4456 VAT / Dr 445 stamp.
 * Net payable = total - withholding, so the entry balances. Refunds (out_refund, in_refund) invert every line.
 * ⚠ Needs accountant verification: stamp duty (445) side, account choice, and the withholding (447) base and rate.
 */
export function invoiceLines(inv: InvoiceForPosting): DraftLine[] {
  const isSale = inv.type === 'out_invoice' || inv.type === 'out_refund';
  const stocked = isSale ? 0n : (inv.stockedUntaxedCents ?? 0n);
  const withheld = isSale ? 0n : (inv.withholdingCents ?? 0n);
  const lines = isSale
    ? [
        ...line('411', 'debit', inv.totalCents, inv.partnerId, inv.number),
        ...line('700', 'credit', inv.untaxedCents, null, inv.number),
        ...line('4457', 'credit', inv.taxCents, null, inv.number),
        ...line('445', 'credit', inv.stampCents, null, inv.number),
      ]
    : [
        ...line('401', 'credit', inv.totalCents - withheld, inv.partnerId, inv.number),
        ...line(inv.withholdingAccountCode ?? '447', 'credit', withheld, null, inv.number),
        ...line(INVENTORY_ACCOUNTS.stockedPurchases, 'debit', stocked, null, inv.number),
        ...line('600', 'debit', inv.untaxedCents - stocked, null, inv.number),
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
  /** Timbre fiscal collected with a cash payment on an out_invoice. Part of amountCents. */
  stampCents?: bigint;
}

/** Cash-register account for cash payments, bank for everything else. */
export function treasuryAccount(method: string): '53' | '512' {
  return method === 'cash' ? '53' : '512';
}

/**
 * Customer receipt (out_invoice): Dr 512|53 / Cr 411. Customer refund: Dr 411 / Cr 512|53.
 * Supplier payment (in_invoice): Dr 401 / Cr 512|53. Supplier refund: Cr 401 / Dr 512|53.
 * Cash receipt with timbre (out_invoice, stampCents > 0): Dr 53 full cash / Cr 411 (cash - stamp) / Cr 445 stamp.
 * ⚠ Needs accountant verification: stamp duty (445) on the cash receipt.
 */
export function paymentLines(p: PaymentForPosting): DraftLine[] {
  const treasury = treasuryAccount(p.method);
  const partnerAccount = p.type === 'out_invoice' || p.type === 'out_refund' ? '411' : '401';
  const partnerDebit = p.type === 'out_refund' || p.type === 'in_invoice';
  const partnerSide: Side = partnerDebit ? 'debit' : 'credit';
  const treasurySide: Side = partnerDebit ? 'credit' : 'debit';
  const stamp = p.stampCents ?? ZERO;
  if (stamp > ZERO && p.type === 'out_invoice') {
    return [
      ...line(treasury, 'debit', p.amountCents, null, p.reference),
      ...line('411', 'credit', p.amountCents - stamp, p.partnerId, p.reference),
      ...line('445', 'credit', stamp, null, p.reference),
    ];
  }
  return [
    ...line(treasury, treasurySide, p.amountCents, null, p.reference),
    ...line(partnerAccount, partnerSide, p.amountCents, p.partnerId, p.reference),
  ];
}

export interface PosPaidForPosting {
  orderId: string;
  number: string;
  method: string;
  totalCents: bigint;
  untaxedCents: bigint;
  taxCents: bigint;
}

export interface CreditPaymentForPosting {
  partnerId: string;
  amountCents: bigint;
  method: string;
  reference: string;
}

/** Instalment receipt: Dr 53 (cash) or 512 (other methods) / Cr 411 client. */
export function creditPaymentLines(p: CreditPaymentForPosting): DraftLine[] {
  return [
    ...line(treasuryAccount(p.method), 'debit', p.amountCents, null, p.reference),
    ...line('411', 'credit', p.amountCents, p.partnerId, p.reference),
  ];
}

export interface CreditContractForPosting {
  partnerId: string;
  number: string;
  financedCents: bigint;
  downPaymentCents: bigint;
  cashPriceCents: bigint;
  markupCents: bigint;
}

/**
 * Instalment contract activation: Dr 411 (financed + down payment) / Cr 700 cash price / Cr 708 markup.
 * Financed + down payment equals cash price + markup, so the entry balances.
 * ⚠ Needs accountant verification: markup account (708) and whether it belongs in 700 or a financial income account.
 */
export function creditContractLines(c: CreditContractForPosting): DraftLine[] {
  return [
    ...line('411', 'debit', c.financedCents + c.downPaymentCents, c.partnerId, c.number),
    ...line('700', 'credit', c.cashPriceCents, null, c.number),
    ...line('708', 'credit', c.markupCents, null, c.number),
  ];
}

/** POS sale: Dr 53 (cash) or 512 (card) total / Cr 700 untaxed / Cr 4457 VAT. */
export function posLines(p: PosPaidForPosting): DraftLine[] {
  return [
    ...line(treasuryAccount(p.method), 'debit', p.totalCents, null, p.number),
    ...line('700', 'credit', p.untaxedCents, null, p.number),
    ...line('4457', 'credit', p.taxCents, null, p.number),
  ];
}

/**
 * Account codes for perpetual inventory postings.
 * SCF mapping to verify with the accountant.
 */
export const INVENTORY_ACCOUNTS = {
  /** Stocks de marchandises, valued at weighted average cost. */
  stock: '30',
  /** Achats de marchandises stockés: goods received, the purchase side before the vendor bill. */
  stockedPurchases: '380',
  /** Achats de marchandises vendues (coût des marchandises vendues). Also used for stock losses and gains. */
  costOfGoodsSold: '600',
} as const;

/**
 * Journal lines for a valued stock move. Receipt: Dr 30 / Cr 380. Delivery: Dr 600 / Cr 30.
 * Return: reverse of delivery (Dr 30 / Cr 600). Loss: Dr 600 / Cr 30. Gain: Dr 30 / Cr 600.
 * Transfers between internal locations have no accounting effect. Zero value produces no lines.
 * SCF mapping to verify with the accountant.
 */
export function stockMoveLines(input: { kind: StockMoveKind; valueCents: bigint; reference: string }): DraftLine[] {
  const { stock, stockedPurchases, costOfGoodsSold } = INVENTORY_ACCOUNTS;
  const v = input.valueCents;
  const ref = input.reference;
  switch (input.kind) {
    case 'receipt':
      return [...line(stock, 'debit', v, null, ref), ...line(stockedPurchases, 'credit', v, null, ref)];
    case 'delivery':
    case 'loss':
      return [...line(costOfGoodsSold, 'debit', v, null, ref), ...line(stock, 'credit', v, null, ref)];
    case 'return':
    case 'gain':
      return [...line(stock, 'debit', v, null, ref), ...line(costOfGoodsSold, 'credit', v, null, ref)];
    case 'transfer':
      return [];
  }
}
