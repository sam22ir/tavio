import { defineModule } from '@/core/modules/define';

export const manifest = defineModule({
  id: 'ai_features',
  name: 'ai_tools.module.name',
  version: '1.0.0',
  depends: [],
  permissions: ['ai_features.assistant.use', 'ai_features.ocr.use'],
  app: { pillar: 'data', icon: 'Sparkles', label: 'shell.apps.ai_features', order: 1 },
  menus: [
    { label: 'ai_tools.menu.assistant', href: '/assistant', perm: 'ai_features.assistant.use', order: 5 },
    { label: 'ai_tools.menu.scan', href: '/invoicing/vendors/scan', perm: 'ai_features.ocr.use', order: 52 },
  ],
  entities: [],
});
