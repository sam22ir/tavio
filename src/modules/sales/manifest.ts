import { defineModule } from '@/core/modules/define';
import { saleOrderEntity } from './entities';

export const manifest = defineModule({
  id: 'sales',
  name: 'sales.module.name',
  version: '1.0.0',
  depends: ['contacts', 'products', 'l10n_dz', 'invoicing'],
  permissions: [
    'sales.order.read',
    'sales.order.write',
    'sales.order.post',
    'sales.order.cancel',
  ],
  app: { pillar: 'sales', icon: 'ShoppingCart', label: 'shell.apps.sales', order: 1 },
  menus: [{ label: 'sales.menu.orders', href: '/sales', perm: 'sales.order.read', order: 50 }],
  events: { emits: ['sales.order.confirmed', 'sales.order.cancelled'] },
  entities: [saleOrderEntity],
});
