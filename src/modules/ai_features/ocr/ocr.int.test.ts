import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, files, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { partners } from '@/modules/contacts/schema';
import { invoices } from '@/modules/invoicing/schema';
import { purchaseOrders } from '@/modules/purchases/schema';
import { billChecks, confirmVendorBill } from './service';

// Storage is in memory, so the test never writes to a real bucket.
vi.mock('@/core/adapters/storage', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/core/adapters/storage')>();
  const memory = new mod.MemoryStorage();
  return { ...mod, getStorage: () => memory };
});

loadDevEnv();

// The dev database is shared and live. Every row sits under a brand-new random company and user.
// No AI call is made: the scan step is not exercised, only the confirm and check services.

const db = getDb();
const PERM = 'ai_features.ocr.use';
const INVOICE_WRITE = 'invoicing.invoice.write';
const bytes = new TextEncoder().encode('bill photo');
const createdCompanies: string[] = [];

interface Fixture { companyId: string; userId: string; supplierId: string }

function args(f: { companyId: string; userId: string }): TenantArgs {
  return { companyId: f.companyId, userId: f.userId, perms: new Set([PERM, INVOICE_WRITE]), locale: 'fr' };
}

async function fixture(): Promise<Fixture> {
  const companyId = randomUUID();
  const userId = randomUUID();
  const supplierId = randomUUID();
  createdCompanies.push(companyId);
  await db.insert(companies).values({ id: companyId, legalName: 'OCR Test SARL', displayName: 'OCR test' });
  await db.insert(users).values({ id: userId, name: 'ocr test', email: `ocr-${userId}@test.invalid` });
  await db.insert(partners).values({
    id: supplierId,
    companyId,
    kind: 'company',
    isSupplier: true,
    displayName: 'Fournisseur Test',
    companyName: 'Fournisseur Test',
    nif: `0001${randomUUID().replace(/\D/g, '').slice(0, 11)}`,
  });
  return { companyId, userId, supplierId };
}

/** A confirmed purchase order for the supplier with one line worth `totalCents`. */
async function confirmedOrder(f: Fixture, totalCents: bigint, number: string): Promise<string> {
  const orderId = randomUUID();
  await db.insert(purchaseOrders).values({
    id: orderId,
    companyId: f.companyId,
    number,
    partnerId: f.supplierId,
    state: 'confirmed',
    orderDate: '2026-03-01',
    untaxedCents: totalCents,
    taxCents: BigInt(0),
    totalCents,
  });
  return orderId;
}

function billInput(f: Fixture, over: Partial<Parameters<typeof confirmVendorBill>[1]> = {}) {
  return {
    partnerId: f.supplierId,
    date: '2026-03-04',
    origin: 'FAC-1',
    lines: [{ description: 'Ciment 50kg', quantity: '10', unitPriceCents: BigInt(85000), taxId: null }],
    fileName: 'bill.jpg',
    contentType: 'image/jpeg' as const,
    bytes,
    poId: null,
    acknowledgeDuplicate: false,
    ...over,
  };
}

async function billsOf(f: Fixture) {
  return db
    .select()
    .from(invoices)
    .where(and(eq(invoices.companyId, f.companyId), eq(invoices.partnerId, f.supplierId), eq(invoices.type, 'in_invoice')));
}

afterAll(async () => {
  if (createdCompanies.length === 0) return;
  await db.delete(files).where(inArray(files.companyId, createdCompanies));
});

describe('vendor bill confirm path', { timeout: 120_000 }, () => {
  it('creates a draft linked to the chosen purchase order', async () => {
    const f = await fixture();
    const poId = await confirmedOrder(f, BigInt(1011500), 'PO-OCR-A1');

    const res = await withTenant(args(f), (c) => confirmVendorBill(c, billInput(f, { poId })), db);
    if (!res.ok) return;

    const [row] = await db.select().from(invoices).where(eq(invoices.id, res.value.invoiceId));
    expect(row?.state).toBe('draft');
    expect(row?.type).toBe('in_invoice');
    expect(row?.origin).toBe('FAC-1');
    expect(row?.sourceEntity).toBe('purchases.order');
    expect(row?.sourceId).toBe(poId);
  });

  it('refuses a second confirm of the same bill without acknowledgement, and creates nothing', async () => {
    const f = await fixture();
    expect((await withTenant(args(f), (c) => confirmVendorBill(c, billInput(f)), db)).ok).toBe(true);

    const again = await withTenant(args(f), (c) => confirmVendorBill(c, billInput(f)), db);
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error.code).toBe('CONFLICT');
      expect(again.error.details?.messageKey).toBe('errors.duplicate_bill');
    }
    expect(await billsOf(f)).toHaveLength(1);
  });

  it('creates the second bill when the user acknowledges it is not a duplicate', async () => {
    const f = await fixture();
    expect((await withTenant(args(f), (c) => confirmVendorBill(c, billInput(f)), db)).ok).toBe(true);

    const forced = await withTenant(args(f), (c) => confirmVendorBill(c, billInput(f, { acknowledgeDuplicate: true })), db);
    expect(forced.ok).toBe(true);
    expect(await billsOf(f)).toHaveLength(2);
  });

  it('a cancelled bill does not count as a duplicate', async () => {
    const f = await fixture();
    const first = await withTenant(args(f), (c) => confirmVendorBill(c, billInput(f)), db);
    if (!first.ok) throw new Error('first confirm failed');
    await db.update(invoices).set({ state: 'cancelled' }).where(eq(invoices.id, first.value.invoiceId));

    const second = await withTenant(args(f), (c) => confirmVendorBill(c, billInput(f)), db);
    expect(second.ok).toBe(true);
  });

  it('flags a purchase order that is already billed', async () => {
    const f = await fixture();
    const poId = await confirmedOrder(f, BigInt(1011500), 'PO-OCR-B1');
    expect((await withTenant(args(f), (c) => confirmVendorBill(c, billInput(f, { poId })), db)).ok).toBe(true);

    // A different supplier number, date and total, so only the purchase order links the two bills.
    const other = await withTenant(
      args(f),
      (c) => confirmVendorBill(c, billInput(f, { poId, origin: 'FAC-99', date: '2026-03-20', lines: [{ description: 'Fer', quantity: '1', unitPriceCents: BigInt(100000), taxId: null }] })),
      db,
    );
    expect(other.ok).toBe(false);
    if (!other.ok) expect(other.error.code).toBe('CONFLICT');
  });

  it('suggests the order by reference and reports duplicates for the chosen supplier', async () => {
    const f = await fixture();
    const poId = await confirmedOrder(f, BigInt(1011500), 'PO-OCR-C1');
    expect((await withTenant(args(f), (c) => confirmVendorBill(c, billInput(f)), db)).ok).toBe(true);

    const checks = await withTenant(
      args(f),
      (c) =>
        billChecks(c, {
          supplierId: f.supplierId,
          number: 'FAC-1',
          poReference: 'po ocr c1',
          date: '2026-03-04',
          total: 10115,
          lines: [{ description: 'Ciment 50kg', quantity: 10, unitPrice: 850, taxRate: 19, taxId: null, productId: null }],
        }),
      db,
    );
    expect(checks.poCandidates[0]).toMatchObject({ id: poId, reason: 'reference' });
    expect(checks.duplicates[0]?.reasons).toContain('origin');
  });
});
