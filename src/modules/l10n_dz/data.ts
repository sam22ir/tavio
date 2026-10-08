// Seed data for the l10n_dz module. Configuration only, not a source of legal truth.
// Every value needs accountant verification before production use.

export interface TaxDefault {
  code: string;
  name: string;
  kind: 'vat' | 'stamp' | 'other';
  rate: string; // percent, numeric(7,4) as string
  scope: 'sale' | 'purchase' | 'both';
  validFrom: string; // ISO date
  validTo: string | null;
  legalRef: string | null;
  isDefaultSale: boolean;
  isDefaultPurchase: boolean;
}

// ⚠ needs accountant verification
export const DZ_TAX_DEFAULTS: readonly TaxDefault[] = [
  {
    // ⚠ needs accountant verification
    code: 'TVA19',
    name: 'TVA 19%',
    kind: 'vat',
    rate: '19.0000',
    scope: 'both',
    validFrom: '2020-01-01', // ⚠ needs accountant verification (start date not in research)
    validTo: null,
    legalRef: 'CIDTA, normal VAT rate. Verify',
    isDefaultSale: true,
    isDefaultPurchase: true,
  },
  {
    // ⚠ needs accountant verification
    code: 'TVA9',
    name: 'TVA 9%',
    kind: 'vat',
    rate: '9.0000',
    scope: 'both',
    validFrom: '2026-01-01',
    validTo: null,
    legalRef: 'Reduced rate, Finance Law 2026 (Loi n° 25-17). Scope needs lawyer verification',
    isDefaultSale: false,
    isDefaultPurchase: false,
  },
];

// Stamp duty (timbre fiscal) on receipts. Fixed amounts in DA by amount tier, not a rate, so kept
// as data outside the taxes table (P1 taxes.kind only allows vat).
// Applied to the whole amount, not per bracket. Finance Law 2025 tiers. ⚠ needs accountant verification
export interface StampDutyTier {
  minAmountDa: number; // inclusive lower bound
  maxAmountDa: number | null; // inclusive upper bound, null = no upper bound
  dutyDa: number;
  validFrom: string;
  legalRef: string;
}

export const DZ_STAMP_DUTY_TIERS: readonly StampDutyTier[] = [
  // ⚠ needs accountant verification
  { minAmountDa: 0, maxAmountDa: 300, dutyDa: 0, validFrom: '2025-01-01', legalRef: 'Finance Law 2025. Verify' },
  // ⚠ needs accountant verification
  { minAmountDa: 300, maxAmountDa: 30000, dutyDa: 1, validFrom: '2025-01-01', legalRef: 'Finance Law 2025. Verify' },
  // ⚠ needs accountant verification
  { minAmountDa: 30000, maxAmountDa: 100000, dutyDa: 1.5, validFrom: '2025-01-01', legalRef: 'Finance Law 2025. Verify' },
  // ⚠ needs accountant verification
  { minAmountDa: 100000, maxAmountDa: null, dutyDa: 2, validFrom: '2025-01-01', legalRef: 'Finance Law 2025. Verify' },
];

export interface CurrencySeed {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
}

export const CURRENCY_SEED: readonly CurrencySeed[] = [
  { code: 'DZD', name: 'Algerian dinar', symbol: 'DA', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'USD', name: 'US dollar', symbol: '$', decimals: 2 },
];
