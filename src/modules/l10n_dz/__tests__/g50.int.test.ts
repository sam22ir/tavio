import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { ensureChart } from '@/modules/accounting/service/chart';
import { postEntry } from '@/modules/accounting/service/entries';
import { cancelInvoice } from '@/modules/invoicing/service/invoices';
import { invoices } from '@/modules/invoicing/schema';
import { partners } from '@/modules/contacts/schema';
import { assertPeriodOpen, getG50Declaration, prepareG50, validateG50 } from '../service/g50';

loadDevEnv();

const userId = randomUUID();
const PERMS = new Set([
  'l10n_dz.g50.read',
  'l10n_dz.g50.write',
  'l10n_dz.g50.post',
  'accounting.entry.write',
  'accounting.entry.post',
  'invoicing.invoice.write',
]);

beforeAll(async () => {
  await getDb()
    .insert(users)
    .values({ id: userId, name: 'g50 test', email: `g50-${userId}@test.invalid` })
    .onConflictDoNothing();
});

async function newCompany(): Promise<TenantArgs> {
  const companyId = randomUUID();
  await getDb().insert(companies).values({ id: companyId, legalName: 'G50 Test SARL', displayName: 'G50 Test' });
  return { userId, companyId, perms: PERMS, locale: 'fr' };
}

describe.skipIf(!process.env.TAVIO_W5_DB)('G50 from posted entries and the validated-month lock (database)', () => {
  it('computes the month from posted VAT, validates it, and blocks later changes to that month', async () => {
    const a = await newCompany();
    await withTenant(a, (ctx) => ensureChart(ctx));

    // Sale: 100 untaxed + 19 VAT (cents). Purchase: 50 untaxed + 9 deductible VAT.
    const sale = await withTenant(a, (ctx) =>
      postEntry(ctx, {
        journalCode: 'VT',
        date: '2026-03-10',
        lines: [
          { accountCode: '411', debitCents: BigInt(11900), creditCents: BigInt(0) },
          { accountCode: '700', debitCents: BigInt(0), creditCents: BigInt(10000) },
          { accountCode: '4457', debitCents: BigInt(0), creditCents: BigInt(1900) },
        ],
      }),
    );
    expect(sale.ok).toBe(true);
    const purchase = await withTenant(a, (ctx) =>
      postEntry(ctx, {
        journalCode: 'AC',
        date: '2026-03-12',
        lines: [
          { accountCode: '600', debitCents: BigInt(5000), creditCents: BigInt(0) },
          { accountCode: '4456', debitCents: BigInt(900), creditCents: BigInt(0) },
          { accountCode: '401', debitCents: BigInt(0), creditCents: BigInt(5900) },
        ],
      }),
    );
    expect(purchase.ok).toBe(true);

    const prepared = await withTenant(a, (ctx) => prepareG50(ctx, 2026, 3));
    expect(prepared.ok && prepared.value.state).toBe('draft');
    expect(prepared.ok && prepared.value.figures).toMatchObject({
      collectedCents: '1900',
      deductibleCents: '900',
      netDueCents: '1000',
      needsAccountantReview: true,
    });

    const validated = await withTenant(a, (ctx) => validateG50(ctx, 2026, 3));
    expect(validated.ok && validated.value.state).toBe('validated');

    const again = await withTenant(a, (ctx) => prepareG50(ctx, 2026, 3));
    expect(again).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });

    const locked = await withTenant(a, (ctx) => assertPeriodOpen(ctx, '2026-03-20'));
    expect(locked).toMatchObject({ ok: false, error: { code: 'POSTED_IMMUTABLE' } });
    const open = await withTenant(a, (ctx) => assertPeriodOpen(ctx, '2026-04-01'));
    expect(open.ok).toBe(true);
  });

  it('a draft invoice dated in a validated month cannot be cancelled', async () => {
    const a = await newCompany();
    await withTenant(a, (ctx) => ensureChart(ctx));
    await withTenant(a, (ctx) => prepareG50(ctx, 2026, 5));
    await withTenant(a, (ctx) => validateG50(ctx, 2026, 5));

    const partnerId = randomUUID();
    await getDb().insert(partners).values({
      id: partnerId,
      companyId: a.companyId,
      kind: 'company',
      isCustomer: true,
      displayName: 'G50 client',
      companyName: 'G50 client',
    });
    const invoiceId = randomUUID();
    await getDb().insert(invoices).values({
      id: invoiceId,
      companyId: a.companyId,
      type: 'out_invoice',
      partnerId,
      state: 'draft',
      date: '2026-05-15',
    });

    const result = await withTenant(a, (ctx) => cancelInvoice(ctx, invoiceId));
    expect(result).toMatchObject({ ok: false, error: { code: 'POSTED_IMMUTABLE' } });
    const stored = await withTenant(a, (ctx) => getG50Declaration(ctx, 2026, 5));
    expect(stored?.state).toBe('validated');
  });
});
