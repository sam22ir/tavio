import { defineModule } from '@/core/modules/define';
import { purchaseOrderEntity } from './entities';

export const manifest = defineModule({
  id: 'purchases',
  name: 'purchases.module.name',
  version: '1.0.0',
  depends: ['contacts', 'products', 'l10n_dz', 'invoicing'],
  permissions: [
    'purchases.order.read',
    'purchases.order.write',
    'purchases.order.post',
    'purchases.order.cancel',
  ],
  app: { pillar: 'operations', icon: 'Truck', label: 'shell.apps.purchases', order: 5 },
  menus: [{ label: 'purchases.menu.orders', href: '/purchases', perm: 'purchases.order.read', order: 53 }],
  events: { emits: ['purchases.order.received'] },
  entities: [purchaseOrderEntity],
});
