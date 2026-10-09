import { defineModule } from '@/core/modules/define';
import { webOrderEntity, websiteSettingsEntity } from './entities';

export const manifest = defineModule({
  id: 'website',
  name: 'website.module.name',
  version: '1.0.0',
  depends: ['products'],
  permissions: [
    'website.settings.read',
    'website.settings.write',
    'website.order.read',
    'website.order.write',
  ],
  app: { pillar: 'acquisition', icon: 'Globe', label: 'shell.apps.website', order: 2 },
  menus: [
    { label: 'website.menu.settings', href: '/website', perm: 'website.settings.read', order: 60 },
    { label: 'website.menu.orders', href: '/website/orders', perm: 'website.order.read', order: 61 },
  ],
  entities: [websiteSettingsEntity, webOrderEntity],
});
