import { defineModule } from '@/core/modules/define';
import { deliveryEntity, reorderRuleEntity, stockMoveEntity, warehouseEntity } from './entities';

export const manifest = defineModule({
  id: 'inventory',
  name: 'inventory.module.name',
  version: '1.0.0',
  depends: ['products', 'credit_sales', 'contacts'],
  permissions: [
    'inventory.warehouse.read',
    'inventory.warehouse.write',
    'inventory.move.read',
    'inventory.move.write',
    'inventory.move.post',
    'inventory.move.cancel',
    'inventory.adjustment.write',
    'inventory.reorder.read',
    'inventory.reorder.write',
    'inventory.delivery.read',
    'inventory.delivery.post',
    'inventory.delivery.cancel',
  ],
  entities: [stockMoveEntity, warehouseEntity, reorderRuleEntity, deliveryEntity],
  app: { pillar: 'operations', icon: 'Warehouse', label: 'shell.apps.inventory', order: 4 },
  menus: [
    { label: 'inventory.menu.stock', href: '/inventory', perm: 'inventory.move.read', order: 52 },
    { label: 'inventory.menu.moves', href: '/inventory/moves', perm: 'inventory.move.read', order: 52 },
    { label: 'inventory.menu.adjustments', href: '/inventory/adjustments', perm: 'inventory.adjustment.write', order: 52 },
    { label: 'inventory.menu.low_stock', href: '/inventory/low-stock', perm: 'inventory.reorder.read', order: 52 },
    { label: 'inventory.menu.valuation', href: '/inventory/valuation', perm: 'inventory.move.read', order: 52 },
    { label: 'inventory.menu.warehouses', href: '/inventory/warehouses', perm: 'inventory.warehouse.read', order: 52 },
    { label: 'inventory.menu.deliveries', href: '/inventory/deliveries', perm: 'inventory.delivery.read', order: 52 },
  ],
});
