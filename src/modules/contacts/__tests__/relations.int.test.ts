import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { relations } from '@/core/relations';
import { deleteTestCompanies } from '@/testing/db-cleanup';
import { creditContracts } from '@/modules/credit_sales/schema';
import { invoices } from '@/modules/invoicing/schema';
import { partnerInput, createPartner } from '../service/partners';
import '@/modules/relation-handlers';

loadDevEnv();

const db = getDb();
const companyIds: string[] = [];
const PERMS = new Set([
  'contacts.partner.read',
  'contacts.partner.write',
  'invoicing.invoice.read',
  'credit_sales.contract.read',
]);

async function fixture(): Promise<TenantArgs> {
  const companyId = randomUUID();
  const userId = randomUUID();
  companyIds.push(companyId);
  await db.insert(companies).values({ id: companyId, legalName: 'Relations SARL', displayName: 'Relations' });
  await db.insert(users).values({ id: userId, name: 'relations test', email: `rel-${userId}@test.invalid` });
  return { userId, companyId, perms: PERMS, locale: 'en' };
}

afterAll(async () => {
  await deleteTestCompanies(db, companyIds);
});

describe.skipIf(!process.env.TAVIO_W5_DB)('contact relations (db)', () => {
  it('counts a contact invoices and credit contracts', async () => {
    const args = await fixture();
    const partnerId = await withTenant(args, async (ctx) => {
      const r = await createPartner(
        ctx,
        partnerInput.parse({
          kind: 'individual',
          isCustomer: true,
          isSupplier: false,
          isProspect: false,
          firstName: 'Karim',
          lastName: 'Haddad',
          phone: '0661 00 00 01',
        }),
      );
      if (!r.ok) throw new Error(r.error.code);
      return r.value.id;
    });

    await withTenant(args, async (ctx) => {
      await ctx.tx.insert(invoices).values({
        companyId: args.companyId,
        partnerId,
        type: 'out_invoice',
        date: "2026-01-15",
      });
      await ctx.tx.insert(creditContracts).values({
        companyId: args.companyId,
        partnerId,
        reference: `CC-${randomUUID().slice(0, 8)}`,
        startDate: '2026-01-01',
        frequency: 'monthly',
        installmentsCount: 6,
        cashPriceCents: 100000n,
        markupCents: 10000n,
        totalCents: 110000n,
        downPaymentCents: 0n,
        financedCents: 110000n,
      });
    });

    const counts = await withTenant(args, (ctx) => relations.countRelations(ctx, 'contacts.partner', partnerId));
    const byId = new Map(counts.map((c) => [c.relation.id, c.count]));
    expect(byId.get('contacts.partner->invoicing.invoice')).toBe(1);
    expect(byId.get('contacts.partner->credit_sales.contract')).toBe(1);
  });
});
