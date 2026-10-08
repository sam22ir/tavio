import { defineModule } from '@/core/modules/define';

export const manifest = defineModule({
  id: 'chatter',
  name: 'chatter.module.name',
  version: '1.0.0',
  depends: [],
  permissions: [
    'chatter.message.read',
    'chatter.message.write',
    'chatter.activity.read',
    'chatter.activity.write',
  ],
  menus: [],
});
