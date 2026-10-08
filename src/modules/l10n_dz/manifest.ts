import { defineModule } from '@/core/modules/define';

export const manifest = defineModule({
  id: 'l10n_dz',
  name: 'l10n.module.name',
  version: '1.0.0',
  depends: [],
  permissions: ['l10n_dz.tax.read', 'l10n_dz.tax.write', 'l10n_dz.tax.delete'],
  menus: [{ label: 'l10n.menu.taxes', href: '/settings/taxes', perm: 'l10n_dz.tax.read', order: 90 }],
});
