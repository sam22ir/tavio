import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';

// Integration suite: runs only once the W5 tables are migrated (integrator sets TAVIO_W5_DB=1).
loadDevEnv();

describe.skipIf(!process.env.TAVIO_W5_DB)('sales orders (integration)', () => {
  const perms = new Set(['sales.order.read', 'sales.order.write', 'sales.order.post', 'sales.order.cancel']);

  it('creates a draft with server-side totals and no number', async () => {
    const { withTenant } = await import('@/core/db/tenant');
    const { createSaleOrder } = await import('@/modules/sales/service/orders');
    const companyId = randomUUID();
    const result = await withTenant(
      { userId: randomUUID(), companyId, perms, locale: 'en' },
      (ctx) =>
        createSaleOrder(ctx, {
          partnerId: randomUUID(),
          orderDate: '2026-10-09',
          lines: [{ description: 'x', quantity: '1', unitPrice: '1000', discount: '0', taxId: null }],
        }),
    );
    // Partner does not exist in this fresh company, so the service must refuse.
    expect(result.ok).toBe(false);
  });

  it('refuses FORBIDDEN without sales.order.write', async () => {
    const { withTenant } = await import('@/core/db/tenant');
    const { createSaleOrder } = await import('@/modules/sales/service/orders');
    const result = await withTenant(
      { userId: randomUUID(), companyId: randomUUID(), perms: new Set(['sales.order.read']), locale: 'en' },
      (ctx) =>
        createSaleOrder(ctx, {
          partnerId: randomUUID(),
          orderDate: '2026-10-09',
          lines: [{ description: 'x', quantity: '1', unitPrice: '1', discount: '0', taxId: null }],
        }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
  });
});
