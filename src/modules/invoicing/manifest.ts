import { defineModule } from '@/core/modules/define';

export const manifest = defineModule({
  id: 'invoicing',
  name: 'invoicing.module.name',
  version: '1.0.0',
  depends: ['contacts', 'l10n_dz'],
  permissions: ['invoicing.invoice.read', 'invoicing.invoice.write', 'invoicing.payment.write'],
  app: { pillar: 'operations', icon: 'FileText', label: 'shell.apps.invoicing', order: 3 },
  menus: [
    { label: 'invoicing.menu.customers', href: '/invoicing/customers', perm: 'invoicing.invoice.read', order: 51 },
    { label: 'invoicing.menu.vendors', href: '/invoicing/vendors', perm: 'invoicing.invoice.read', order: 51 },
  ],
  entities: [],
});
