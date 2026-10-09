import { defineModule } from '@/core/modules/define';

export const manifest = defineModule({
  id: 'automation',
  name: 'automation.module.name',
  version: '1.0.0',
  depends: ['chatter'],
  permissions: ['automation.rule.read', 'automation.rule.write'],
  app: { pillar: 'technology', icon: 'Workflow', label: 'shell.apps.automation', order: 2 },
  menus: [
    { label: 'automation.menu.rules', href: '/settings/automation', perm: 'automation.rule.read', order: 96 },
  ],
});
