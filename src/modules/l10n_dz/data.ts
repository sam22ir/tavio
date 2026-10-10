// Seed data for the l10n_dz module. Configuration only, not a source of legal truth.
// Every value needs accountant verification before production use.
import { applyRate, type Cents } from '@/core/money';

export const TAX_KINDS = ['tva', 'tap', 'retenue_source', 'other'] as const;
export type TaxKind = (typeof TAX_KINDS)[number];

export interface TaxDefault {
  code: string;
  name: string;
  kind: TaxKind;
  rate: string; // percent, numeric(7,4) as string
  scope: 'sale' | 'purchase' | 'both';
  validFrom: string; // ISO date
  validTo: string | null;
  legalRef: string | null;
  isDefaultSale: boolean;
  isDefaultPurchase: boolean;
  // Account the tax is posted to. TVA: 4457 on sales, 4456 on purchases. Others: 447.
  saleAccountCode: string;
  purchaseAccountCode: string;
  // Inactive taxes are seeded but not offered on documents until the accountant confirms them.
  active: boolean;
}

// ⚠ needs accountant verification
export const DZ_TAX_DEFAULTS: readonly TaxDefault[] = [
  {
    // ⚠ needs accountant verification
    code: 'TVA19',
    name: 'TVA 19%',
    kind: 'tva',
    rate: '19.0000',
    scope: 'both',
    validFrom: '2020-01-01', // ⚠ needs accountant verification (start date not in research)
    validTo: null,
    legalRef: 'CIDTA, normal VAT rate. Verify',
    isDefaultSale: true,
    isDefaultPurchase: true,
    saleAccountCode: '4457',
    purchaseAccountCode: '4456',
    active: true,
  },
  {
    // ⚠ needs accountant verification
    code: 'TVA9',
    name: 'TVA 9%',
    kind: 'tva',
    rate: '9.0000',
    scope: 'both',
    validFrom: '2026-01-01',
    validTo: null,
    legalRef: 'Reduced rate, Finance Law 2026 (Loi n° 25-17). Scope needs lawyer verification',
    isDefaultSale: false,
    isDefaultPurchase: false,
    saleAccountCode: '4457',
    purchaseAccountCode: '4456',
    active: true,
  },
  {
    // ⚠ Rate not confirmed. Inactive until the accountant sets the rate and applicability.
    code: 'TAP',
    name: 'TAP (taxe sur l’activité professionnelle)',
    kind: 'tap',
    rate: '0.0000',
    scope: 'sale',
    validFrom: '2020-01-01',
    validTo: null,
    legalRef: 'TAP rate and scope to confirm with the accountant. Inactive by default',
    isDefaultSale: false,
    isDefaultPurchase: false,
    saleAccountCode: '447',
    purchaseAccountCode: '447',
    active: false,
  },
  {
    // ⚠ Placeholder rate. Set the rate the accountant confirms before activating.
    code: 'RAS',
    name: 'Retenue à la source (services)',
    kind: 'retenue_source',
    rate: '0.0000',
    scope: 'purchase',
    validFrom: '2020-01-01',
    validTo: null,
    legalRef: 'Withholding on supplier services. Rate to confirm with the accountant. Inactive by default',
    isDefaultSale: false,
    isDefaultPurchase: false,
    saleAccountCode: '447',
    purchaseAccountCode: '447',
    active: false,
  },
];

export const L10N_PAYMENT_METHODS = ['cash', 'ccp', 'transfer', 'cib', 'edahabia', 'cheque'] as const;
export const DEFAULT_STAMP_METHODS: readonly string[] = ['cash'];

// Stamp duty (timbre fiscal). Tiers are stored per company and editable. These are the seed values.
// Tier semantics: a tier applies while the amount (whole DA, centimes dropped) is below upToDa.
// Tiers are ordered ascending; the last tier has upToDa null (no upper bound).
// ⚠ needs accountant verification
export interface StampTierSeed {
  upToDa: number | null;
  mode: 'fixed' | 'rate';
  fixedCents: number;
  ratePercent: string;
}

export const DZ_STAMP_DUTY_SEED: readonly StampTierSeed[] = [
  // ⚠ needs accountant verification (Finance Law 2025 tiers, to verify)
  { upToDa: 300, mode: 'fixed', fixedCents: 0, ratePercent: '0' },
  { upToDa: 30000, mode: 'fixed', fixedCents: 100, ratePercent: '0' },
  { upToDa: 100000, mode: 'fixed', fixedCents: 150, ratePercent: '0' },
  { upToDa: null, mode: 'fixed', fixedCents: 200, ratePercent: '0' },
];

/** A stamp tier as used by the calculation. Amounts in whole DA, fixed duty in centimes. */
export interface StampTier {
  upToDa: bigint | null;
  mode: 'fixed' | 'rate';
  fixedCents: Cents;
  ratePercent: string;
}

export function stampTiersFromSeed(seed: readonly StampTierSeed[] = DZ_STAMP_DUTY_SEED): StampTier[] {
  return seed.map((s) => ({
    upToDa: s.upToDa === null ? null : BigInt(s.upToDa),
    mode: s.mode,
    fixedCents: BigInt(s.fixedCents),
    ratePercent: s.ratePercent,
  }));
}

/** Duty for one tier applied to an amount. Used by stampDutyCents. */
export function tierDutyCents(tier: StampTier, amountCents: Cents): Cents {
  return tier.mode === 'fixed' ? tier.fixedCents : applyRate(amountCents, tier.ratePercent);
}

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
