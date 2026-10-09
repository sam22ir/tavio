import { defineModule } from '@/core/modules/define';

export const manifest = defineModule({
  id: 'subscriptions',
  name: 'subscriptions.module.name',
  version: '1.0.0',
  depends: [],
  permissions: ['subscriptions.subscription.read'],
  menus: [
    { label: 'subscriptions.menu.billing', href: '/settings/billing', perm: 'subscriptions.subscription.read', order: 97 },
  ],
});
