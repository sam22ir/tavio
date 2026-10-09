import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { partners } from '@/modules/contacts/schema';
import { products, uoms } from '@/modules/products/schema';
import { purchaseProductSuppliers } from '../schema';

loadDevEnv();

// Needs the W13-PO migration applied (integrator). Skipped until TAVIO_W5_DB is set.
describe.skipIf(!process.env.TAVIO_W5_DB)('purchase_product_suppliers (integration)', () => {
  const db = getDb();
  const userId = randomUUID();
  const companyA = randomUUID();
  const companyB = randomUUID();
  const partnerA = randomUUID();
  const productA = randomUUID();

  const argsFor = (companyId: string): TenantArgs => ({
    userId,
    companyId,
    perms: new Set(['*']),
    locale: 'en',
  });

  afterAll(async () => {
    await db.delete(purchaseProductSuppliers).where(inArray(purchaseProductSuppliers.companyId, [companyA, companyB]));
    await db.delete(products).where(inArray(products.companyId, [companyA, companyB]));
    await db.delete(partners).where(inArray(partners.companyId, [companyA, companyB]));
    await db.delete(companies).where(inArray(companies.id, [companyA, companyB]));
    await db.delete(users).where(inArray(users.id, [userId]));
  });

  it('hides a supplier link from another tenant', async () => {
    await db.insert(users).values({ id: userId, name: 'Supplier isolation', email: `sup-${userId}@test.invalid` });
    await db.insert(companies).values([
      { id: companyA, legalName: 'Sup A', displayName: 'Sup A' },
      { id: companyB, legalName: 'Sup B', displayName: 'Sup B' },
    ]);
    // uoms is a global reference table: reuse a seeded unit, never insert one.
    const [uom] = await db.select({ id: uoms.id }).from(uoms).limit(1);
    if (!uom) throw new Error('no seeded unit of measure');
    await db.insert(partners).values({
      id: partnerA,
      companyId: companyA,
      kind: 'company',
      isSupplier: true,
      companyName: 'Fournisseur A',
      displayName: 'Fournisseur A',
    });
    await db.insert(products).values({
      id: productA,
      companyId: companyA,
      name: 'Ciment',
      kind: 'goods',
      uomId: uom.id,
      salePriceCents: BigInt(0),
      costCents: BigInt(0),
    });
    await withTenant(
      argsFor(companyA),
      (ctx) =>
        ctx.tx.insert(purchaseProductSuppliers).values({
          companyId: companyA,
          createdBy: userId,
          productId: productA,
          partnerId: partnerA,
        }),
      db,
    );

    const own = await withTenant(argsFor(companyA), (ctx) => ctx.tx.select().from(purchaseProductSuppliers), db);
    const foreign = await withTenant(argsFor(companyB), (ctx) => ctx.tx.select().from(purchaseProductSuppliers), db);
    expect(own).toHaveLength(1);
    expect(foreign).toHaveLength(0);
  });
});
