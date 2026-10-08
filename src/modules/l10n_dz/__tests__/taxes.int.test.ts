import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { taxes } from '../schema';
import { archiveTax, createTax, listTaxes, loadAlgerianDefaults, taxOptions } from '../service/taxes';

loadDevEnv();

const userId = randomUUID();

beforeAll(async () => {
  await getDb()
    .insert(users)
    .values({ id: userId, name: 'taxes test', email: `taxes-${userId}@test.invalid` })
    .onConflictDoNothing();
});

async function newCompany(): Promise<TenantArgs> {
  const companyId = randomUUID();
  await getDb().insert(companies).values({ id: companyId, legalName: 'Taxes Test SARL', displayName: 'Taxes Test' });
  return { userId, companyId, perms: new Set(['l10n_dz.tax.write']), locale: 'fr' };
}

describe('l10n_dz taxes', () => {
  it('loadAlgerianDefaults twice leaves 2 VAT taxes', async () => {
    const a = await newCompany();
    await withTenant(a, (ctx) => loadAlgerianDefaults(ctx));
    const second = await withTenant(a, (ctx) => loadAlgerianDefaults(ctx));
    expect(second).toEqual({ ok: true, value: { inserted: 0 } });

    const vat = await withTenant(a, async (ctx) =>
      ctx.tx.select().from(taxes).where(and(eq(taxes.companyId, a.companyId), eq(taxes.kind, 'vat'))),
    );
    expect(vat).toHaveLength(2);
  });

  it('create, duplicate detection, archive and options', async () => {
    const a = await newCompany();
    const input = {
      code: 'TVA0',
      name: 'TVA 0%',
      kind: 'vat' as const,
      rate: '0',
      scope: 'both' as const,
      validFrom: '2024-01-01',
      validTo: null,
      legalRef: null,
      isDefaultSale: false,
      isDefaultPurchase: false,
      active: true,
    };
    const created = await withTenant(a, (ctx) => createTax(ctx, input));
    expect(created.ok).toBe(true);
    const dup = await withTenant(a, (ctx) => createTax(ctx, input));
    expect(dup).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });

    const id = created.ok ? created.value.id : '';
    const archived = await withTenant(a, (ctx) => archiveTax(ctx, id));
    expect(archived.ok && archived.value.active).toBe(false);

    const all = await withTenant(a, (ctx) => listTaxes(ctx));
    expect(all.map((t) => t.code)).toEqual(['TVA0']);
    const options = await withTenant(a, (ctx) => taxOptions(ctx));
    expect(options).toEqual([]);
  });

  it('isolates taxes between companies', async () => {
    const a = await newCompany();
    const b = await newCompany();
    await withTenant(a, (ctx) => loadAlgerianDefaults(ctx));
    const seenByB = await withTenant(b, (ctx) => listTaxes(ctx));
    expect(seenByB).toEqual([]);
  });
});
