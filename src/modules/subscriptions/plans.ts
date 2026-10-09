// SaaS plan catalogue and pure entitlement checks. No I/O.

export interface SaasPlanSeed {
  code: 'free' | 'pro' | 'business';
  name: string;
  /** Per user per month, bigint cents of DZD. ⚠ Placeholder prices: confirm with the business owner before launch. */
  pricePerUserCents: bigint;
  maxUsers: number;
  modules: readonly string[];
}

const PRO_MODULES = [
  'contacts', 'credit_sales', 'chatter', 'l10n_dz', 'products', 'crm',
  'sales', 'invoicing', 'purchases', 'inventory', 'pos', 'automation',
] as const;

const BUSINESS_MODULES = [
  ...PRO_MODULES, 'accounting', 'hr', 'projects', 'helpdesk', 'website', 'marketing', 'platform', 'subscriptions',
] as const;

export const SAAS_PLAN_SEED: readonly SaasPlanSeed[] = [
  {
    code: 'free',
    name: 'Free',
    pricePerUserCents: 0n,
    maxUsers: 1,
    modules: ['core', 'contacts', 'credit_sales'],
  },
  {
    code: 'pro',
    name: 'Pro',
    pricePerUserCents: 290000n, // ⚠ 2 900 DZD, placeholder
    maxUsers: 5,
    modules: PRO_MODULES,
  },
  {
    code: 'business',
    name: 'Business',
    pricePerUserCents: 590000n, // ⚠ 5 900 DZD, placeholder
    maxUsers: 25,
    modules: BUSINESS_MODULES,
  },
];

/** True when the plan includes the module. Unknown modules are denied. */
export function isModuleAllowed(plan: { modules: readonly string[] }, moduleId: string): boolean {
  return plan.modules.includes(moduleId);
}

/** Monthly price for a seat count, in cents. */
export function monthlyTotalCents(plan: Pick<SaasPlanSeed, 'pricePerUserCents'>, seats: number): bigint {
  return plan.pricePerUserCents * BigInt(seats);
}

export function seatsWithinPlan(plan: Pick<SaasPlanSeed, 'maxUsers'>, seats: number): boolean {
  return Number.isInteger(seats) && seats >= 1 && seats <= plan.maxUsers;
}
