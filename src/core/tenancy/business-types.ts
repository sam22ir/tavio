// Onboarding business types. Each lists the modules to enable for the company. Missing rows are inserted
// as enabled; existing rows (including defaults other modules depend on) are left as they are.
export const BUSINESS_TYPES = ['commerce', 'wholesale', 'services', 'other'] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_TYPE_MODULES: Record<BusinessType, readonly string[]> = {
  commerce: ['credit_sales', 'pos', 'inventory', 'invoicing', 'crm', 'contacts', 'products'],
  wholesale: ['sales', 'purchases', 'inventory', 'invoicing', 'accounting', 'contacts', 'products'],
  services: ['crm', 'projects', 'helpdesk', 'invoicing', 'contacts'],
  other: [],
};

export function isBusinessType(value: string): value is BusinessType {
  return (BUSINESS_TYPES as readonly string[]).includes(value);
}
