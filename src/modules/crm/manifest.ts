import { defineModule } from '@/core/modules/define';

export const manifest = defineModule({
  id: 'crm',
  name: 'crm.module.name',
  version: '0.1.0',
  depends: ['contacts', 'chatter'],
  permissions: ['crm.lead.read', 'crm.lead.write', 'crm.lead.delete'],
  menus: [{ label: 'crm.menu.leads', href: '/crm', perm: 'crm.lead.read', order: 40 }],
});
