import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, sequences, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { partners } from '@/modules/contacts/schema';
import { invoices } from '../schema';
import { createInvoice } from '../service/create';
import { cancelInvoice, createRefund, postInvoice, registerPayment } from '../service/invoices';

loadDevEnv();

const db = getDb();
const createdCompanies: string[] = [];
const enabled = !!process.env.TAVIO_W5_DB;

async function fixture(): Promise<{ args: TenantArgs; partnerId: string }> {
  const companyId = randomUUID();
  const userId = randomUUID();
  const partnerId = randomUUID();
  createdCompanies.push(companyId);
  await db.insert(companies).values({ id: companyId, legalName: 'Test SARL', displayName: 'Test' });
  await db.insert(users).values({ id: userId, name: 'invoicing test', email: `inv-${userId}@test.invalid` });
  await db.insert(partners).values({
    id: partnerId, companyId, kind: 'individual', isCustomer: true, displayName: 'Client Test',
    firstName: 'Client', lastName: 'Test', phone: '+213555000222',
  });
  return { args: { userId, companyId, perms: new Set(['*']), locale: 'en' }, partnerId };
}

afterAll(async () => {
  if (createdCompanies.length) await db.delete(sequences).where(inArray(sequences.companyId, createdCompanies));
});

describe.skipIf(!enabled)('invoicing lifecycle', { timeout: 60_000 }, () => {
  it('posts with gap-free numbers and locks the document', async () => {
    const f = await fixture();
    const created = await withTenant(f.args, (ctx) =>
      createInvoice(ctx, { type: 'out_invoice', partnerId: f.partnerId, lines: [{ description: 'Item', quantity: '2', unitPriceCents: BigInt(10000) }] }),
    );
    expect(created.ok).toBe(true);
    const id = created.ok ? created.value.id : '';
    const posted = await withTenant(f.args, (ctx) => postInvoice(ctx, id));
    expect(posted.ok && posted.value.number).toMatch(/^FAC-\d{4}-00001$/);
    const again = await withTenant(f.args, (ctx) => postInvoice(ctx, id));
    expect(!again.ok && again.error.code).toBe('POSTED_IMMUTABLE');
    const cancelled = await withTenant(f.args, (ctx) => cancelInvoice(ctx, id));
    expect(!cancelled.ok && cancelled.error.code).toBe('POSTED_IMMUTABLE');
    const [row] = await db.select().from(invoices).where(inArray(invoices.id, [id]));
    expect(row?.totalCents).toBe(BigInt(20000));
  });

  it('adds timbre on cash payment once and rejects overpayment', async () => {
    const f = await fixture();
    const created = await withTenant(f.args, (ctx) =>
      createInvoice(ctx, { type: 'out_invoice', partnerId: f.partnerId, lines: [{ description: 'Item', quantity: '1', unitPriceCents: BigInt(50000) }] }),
    );
    const id = created.ok ? created.value.id : '';
    await withTenant(f.args, (ctx) => postInvoice(ctx, id));
    const pay = await withTenant(f.args, (ctx) => registerPayment(ctx, id, { amountCents: BigInt(50000), method: 'cash' }));
    expect(pay.ok).toBe(true);
    const [row] = await db.select().from(invoices).where(inArray(invoices.id, [id]));
    // 500 DZD falls in the 300 to 30000 DA tier, duty 1 DA (100 cents). ⚠ needs accountant verification
    expect(row?.stampCents).toBe(BigInt(100));
    const over = await withTenant(f.args, (ctx) => registerPayment(ctx, id, { amountCents: BigInt(10_000_000), method: 'transfer' }));
    expect(!over.ok && over.error.code).toBe('VALIDATION');
  });

  it('creates a draft refund that numbers as AV- when posted', async () => {
    const f = await fixture();
    const created = await withTenant(f.args, (ctx) =>
      createInvoice(ctx, { type: 'out_invoice', partnerId: f.partnerId, lines: [{ description: 'Item', quantity: '1', unitPriceCents: BigInt(1000) }] }),
    );
    const id = created.ok ? created.value.id : '';
    await withTenant(f.args, (ctx) => postInvoice(ctx, id));
    const refund = await withTenant(f.args, (ctx) => createRefund(ctx, id));
    expect(refund.ok).toBe(true);
    const refundId = refund.ok ? refund.value.id : '';
    const posted = await withTenant(f.args, (ctx) => postInvoice(ctx, refundId));
    expect(posted.ok && posted.value.number).toMatch(/^AV-\d{4}-00001$/);
  });
});
