import { defineModule } from '@/core/modules/define';

export const manifest = defineModule({
  id: 'crm',
  name: 'crm.module.name',
  version: '0.1.0',
  depends: ['contacts', 'chatter', 'credit_sales'],
  permissions: ['crm.lead.read', 'crm.lead.write', 'crm.lead.delete', 'crm.leads.view_team', 'crm.leads.view_all'],
  app: { pillar: 'acquisition', icon: 'Target', label: 'shell.apps.crm', order: 1 },
  menus: [{ label: 'crm.menu.leads', href: '/crm', perm: 'crm.lead.read', order: 40 }],
});
