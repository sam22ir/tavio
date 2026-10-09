import { defineModule } from '@/core/modules/define';
import { accountEntity, entryEntity } from './entities';

export const manifest = defineModule({
  id: 'accounting',
  name: 'accounting.module.name',
  version: '1.0.0',
  depends: ['contacts'],
  permissions: [
    'accounting.account.read',
    'accounting.account.write',
    'accounting.journal.read',
    'accounting.journal.write',
    'accounting.entry.read',
    'accounting.entry.write',
    'accounting.report.read',
  ],
  menus: [
    { label: 'accounting.menu.entries', href: '/accounting/entries', perm: 'accounting.entry.read', order: 54 },
    { label: 'accounting.menu.accounts', href: '/accounting/accounts', perm: 'accounting.account.read', order: 54 },
    { label: 'accounting.menu.journals', href: '/accounting/journals', perm: 'accounting.journal.read', order: 54 },
    { label: 'accounting.menu.reports', href: '/accounting/reports', perm: 'accounting.report.read', order: 54 },
  ],
  entities: [accountEntity, entryEntity],
});
