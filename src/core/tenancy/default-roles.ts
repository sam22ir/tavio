// Seeded roles for every new company (DATA_MODEL.md 2.4, task W2-E).
export type DefaultRoleKey = 'owner' | 'admin' | 'manager' | 'staff';

export interface DefaultRole {
  readonly key: DefaultRoleKey;
  readonly name: string;
  readonly permissions: readonly string[];
}

export const DEFAULT_ROLES: readonly DefaultRole[] = [
  { key: 'owner', name: 'Owner', permissions: ['*'] },
  { key: 'admin', name: 'Admin', permissions: ['*'] },
  {
    key: 'manager',
    name: 'Manager',
    permissions: ['contacts.*', 'products.*', 'credit_sales.*', 'crm.*', 'settings.read'],
  },
  {
    key: 'staff',
    name: 'Staff',
    permissions: [
      'contacts.partner.read',
      'contacts.partner.write',
      'products.product.read',
      'credit_sales.contract.read',
      'credit_sales.payment.write',
      'crm.lead.*',
    ],
  },
];

// Modules enabled for every new company.
export const DEFAULT_MODULES: readonly string[] = [
  'core',
  'contacts',
  'products',
  'l10n_dz',
  'chatter',
  'credit_sales',
  'crm',
];
