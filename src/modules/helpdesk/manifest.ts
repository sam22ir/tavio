import { defineModule } from '@/core/modules/define';
import { ticketEntity } from './entities';

export const manifest = defineModule({
  id: 'helpdesk',
  name: 'helpdesk.module.name',
  version: '1.0.0',
  depends: ['contacts'],
  permissions: [
    'helpdesk.ticket.read',
    'helpdesk.ticket.write',
    'helpdesk.team.read',
    'helpdesk.team.write',
  ],
  menus: [{ label: 'helpdesk.menu.tickets', href: '/helpdesk', perm: 'helpdesk.ticket.read', order: 62 }],
  entities: [ticketEntity],
});
