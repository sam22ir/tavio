import { defineModule } from '@/core/modules/define';
import { categoryEntity, productEntity } from './entities';

export const manifest = defineModule({
  id: 'products',
  name: 'products.module.name',
  version: '1.0.0',
  depends: [],
  entities: [productEntity, categoryEntity],
  permissions: [
    'products.product.read',
    'products.product.write',
    'products.product.delete',
    'products.category.read',
    'products.category.write',
    'products.category.delete',
  ],
  menus: [{ label: 'products.menu.products', href: '/products', perm: 'products.product.read', order: 20 }],
});
