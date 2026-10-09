import { defineModule } from '@/core/modules/define';

export const manifest = defineModule({
  id: 'platform',
  name: 'platform.module.name',
  version: '1.0.0',
  depends: ['contacts', 'products'],
  permissions: [
    'platform.custom_field.read',
    'platform.custom_field.write',
    'platform.api_key.read',
    'platform.api_key.write',
    'platform.webhook.read',
    'platform.webhook.write',
  ],
  app: { pillar: 'technology', icon: 'Plug', label: 'shell.apps.platform', order: 1 },
  menus: [{ label: 'platform.menu.title', href: '/settings/platform', perm: 'platform.api_key.read', order: 95 }],
});
