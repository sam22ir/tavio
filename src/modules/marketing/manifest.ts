import { defineModule } from '@/core/modules/define';
import { campaignEntity } from './entities';

export const manifest = defineModule({
  id: 'marketing',
  name: 'marketing.module.name',
  version: '1.0.0',
  depends: ['contacts', 'credit_sales', 'chatter'],
  permissions: ['marketing.campaign.read', 'marketing.campaign.write'],
  menus: [{ label: 'marketing.menu.campaigns', href: '/marketing', perm: 'marketing.campaign.read', order: 70 }],
  entities: [campaignEntity],
});
