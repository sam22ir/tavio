import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { uoms } from '@/modules/products/schema';
import { createProduct, getProduct, listProducts, updateProduct, type ProductInput } from '@/modules/products/service/products';
import { createCategory } from '@/modules/products/service/categories';
import { defaultListQuery } from './helpers';

loadDevEnv();

const PERMS = new Set([
  'products.product.read',
  'products.product.write',
  'products.category.read',
  'products.category.write',
]);

const userId = randomUUID();
const companyA = randomUUID();
const companyB = randomUUID();
let uomId = '';

const argsFor = (companyId: string): TenantArgs => ({ userId, companyId, perms: PERMS, locale: 'en' });

function input(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    name: 'Ciment 50kg',
    nameAr: null,
    sku: null,
    barcode: null,
    categoryId: null,
    kind: 'goods',
    uomId,
    salePriceCents: '1500.50',
    costCents: '1200',
    trackStock: true,
    active: true,
    description: null,
    ...overrides,
  };
}

beforeAll(async () => {
  const db = getDb();
  await db.insert(users).values({ id: userId, name: 'products test', email: `products-${userId}@test.invalid` });
  await db.insert(companies).values([
    { id: companyA, legalName: `products A ${companyA}`, displayName: `A ${companyA.slice(0, 8)}` },
    { id: companyB, legalName: `products B ${companyB}`, displayName: `B ${companyB.slice(0, 8)}` },
  ]);
  const [unitRow] = await db.select({ id: uoms.id }).from(uoms).where(eq(uoms.code, 'unit')).limit(1);
  if (!unitRow) throw new Error('seeded uom "unit" missing: run scripts/seed-global.ts');
  uomId = unitRow.id;
});

describe('products service', () => {
  it('creates, updates and lists products with DZD prices as cents', async () => {
    const a = argsFor(companyA);
    const created = await withTenant(a, (ctx) => createProduct(ctx, input()));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.value.id;

    const fetched = await withTenant(a, (ctx) => getProduct(ctx, id));
    expect(fetched.ok && fetched.value.salePriceCents).toBe(BigInt(150050));

    const updated = await withTenant(a, (ctx) =>
      updateProduct(ctx, { ...input({ name: 'Ciment 25kg', salePriceCents: '900', active: false }), id }),
    );
    expect(updated.ok).toBe(true);

    const listed = await withTenant(a, (ctx) => listProducts(ctx, { ...defaultListQuery(), q: 'Ciment 25' }));
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.total).toBe(1);
    expect(listed.value.rows[0]?.salePriceCents).toBe(BigInt(90000));
    expect(listed.value.rows[0]?.active).toBe(false);
  });

  it('rejects a duplicate sku and an invalid price', async () => {
    const a = argsFor(companyA);
    const sku = `SKU-${randomUUID().slice(0, 8)}`;
    const first = await withTenant(a, (ctx) => createProduct(ctx, input({ sku })));
    expect(first.ok).toBe(true);
    const dup = await withTenant(a, (ctx) => createProduct(ctx, input({ sku, name: 'Other' })));
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe('CONFLICT');
    const bad = await withTenant(a, (ctx) => createProduct(ctx, input({ salePriceCents: '12.345' })));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('VALIDATION');
  });

  it('creates categories and keeps them isolated per company', async () => {
    const name = `Cat ${randomUUID().slice(0, 6)}`;
    const cat = await withTenant(argsFor(companyA), (ctx) => createCategory(ctx, { name, code: null, parentId: null }));
    expect(cat.ok).toBe(true);
    if (!cat.ok) return;
    const created = await withTenant(argsFor(companyA), (ctx) =>
      createProduct(ctx, input({ name: 'Categorized', categoryId: cat.value.id })),
    );
    expect(created.ok).toBe(true);
    const fromOther = await withTenant(argsFor(companyB), (ctx) => getProduct(ctx, created.ok ? created.value.id : ''));
    expect(fromOther.ok).toBe(false);
    if (!fromOther.ok) expect(fromOther.error.code).toBe('NOT_FOUND');
    const listB = await withTenant(argsFor(companyB), (ctx) => listProducts(ctx, { ...defaultListQuery(), q: 'Categorized' }));
    expect(listB.ok && listB.value.total).toBe(0);
  });
});
