import { defineModule } from '@/core/modules/define';
import { partnerEntity } from './entities';

export const manifest = defineModule({
  id: 'contacts',
  name: 'contacts.module.name',
  version: '1.0.0',
  depends: [],
  permissions: ['contacts.partner.read', 'contacts.partner.write', 'contacts.partner.delete'],
  menus: [{ label: 'contacts.menu.partners', href: '/contacts', perm: 'contacts.partner.read', order: 10 }],
  entities: [partnerEntity],
});
