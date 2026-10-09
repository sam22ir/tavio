import { defineModule } from '@/core/modules/define';

export const manifest = defineModule({
  id: 'pos',
  name: 'pos.module.name',
  version: '1.0.0',
  depends: ['contacts', 'products', 'l10n_dz'],
  permissions: ['pos.session.read', 'pos.session.write', 'pos.order.read', 'pos.order.post'],
  app: { pillar: 'sales', icon: 'Store', label: 'shell.apps.pos', order: 3 },
  menus: [{ label: 'pos.menu.sessions', href: '/pos', perm: 'pos.session.read', order: 55 }],
  events: { emits: ['pos.order.paid'] },
});
