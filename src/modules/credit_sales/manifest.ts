import { defineModule } from '@/core/modules/define';
import { contractEntity, paymentEntity } from './entities';

export const manifest = defineModule({
  id: 'credit_sales',
  name: 'credit.module.name',
  version: '1.0.0',
  depends: ['contacts', 'products', 'chatter'],
  permissions: [
    'credit_sales.contract.read',
    'credit_sales.contract.write',
    'credit_sales.contract.delete',
    'credit_sales.contract.activate',
    'credit_sales.contract.cancel',
    'credit_sales.payment.read',
    'credit_sales.payment.write',
    'credit_sales.payment.delete',
  ],
  entities: [contractEntity, paymentEntity],
  app: { pillar: 'sales', icon: 'CreditCard', label: 'shell.apps.credit_sales', order: 2 },
  menus: [
    { label: 'credit.menu.contracts', href: '/credit/contracts', perm: 'credit_sales.contract.read', order: 30 },
    { label: 'credit.menu.payments', href: '/credit/payments', perm: 'credit_sales.payment.read', order: 31 },
    { label: 'credit.menu.overdue', href: '/credit/overdue', perm: 'credit_sales.contract.read', order: 32 },
  ],
});
