import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { deleteTestCompanies } from '@/testing/db-cleanup';
// Registers every cross-module handler, as the running app does through the action runner.
import '@/modules/event-handlers';
import { createPartner } from '@/modules/contacts/service/partners';
import { products, uoms } from '@/modules/products/schema';
import { accounts, journalEntries, journalLines } from '@/modules/accounting/schema';
import { deliveries, deliveryLines, stockMoves } from '@/modules/inventory/schema';
import { onHandByLocation } from '@/modules/inventory/service/stock';
import {
  confirmOrder as confirmSaleOrder,
  createInvoiceFromOrder,
  createSaleOrder,
} from '@/modules/sales/service/orders';
import { postInvoice, registerPayment } from '@/modules/invoicing/service/invoices';
import { invoices } from '@/modules/invoicing/schema';
import { activateContract, createDraftContract } from '@/modules/credit_sales/service/contracts';
import { recordPayment } from '@/modules/credit_sales/service/payments';
import {
  confirmOrder as confirmPurchaseOrder,
  createOrder as createPurchaseOrder,
  receiveOrder,
} from '@/modules/purchases/service/orders';

loadDevEnv();

const db = getDb();
const userId = randomUUID();
const companyId = randomUUID();
const args: TenantArgs = { userId, companyId, perms: new Set(['*']), locale: 'en' };
let uomId = '';
const productId = randomUUID();

// State shared between the steps of one flow, in order.
let partnerId = '';
let saleOrderId = '';
let invoiceId = '';

describe.skipIf(!process.env.TAVIO_W5_DB)('cross-module flows (integration)', () => {
  afterAll(async () => {
    await deleteTestCompanies(db, [companyId]);
    await db.delete(users).where(eq(users.id, userId));
  });

  it('sets up a fresh company, a product and a partner', async () => {
    await db.insert(companies).values({ id: companyId, legalName: 'Flows SARL', displayName: 'Flows' });
    await db.insert(users).values({ id: userId, name: 'flows test', email: `flows-${userId}@test.invalid` });
    const [unitRow] = await db.select({ id: uoms.id }).from(uoms).where(eq(uoms.code, 'unit')).limit(1);
    if (!unitRow) throw new Error('seeded uom "unit" missing: run scripts/seed-global.ts');
    uomId = unitRow.id;
    await db.insert(products).values({
      id: productId,
      companyId,
      name: 'Cement bag',
      kind: 'goods', trackStock: true,

      uomId,
      salePriceCents: BigInt(100000),
      costCents: BigInt(50000),
    });
    const partner = await withTenant(args, (ctx) =>
      createPartner(ctx, {
        kind: 'company',
        isCustomer: true,
        isSupplier: true,
        isProspect: false,
        firstName: undefined,
        lastName: undefined,
        companyName: 'Flows partner',
        nif: undefined,
        nis: undefined,
        rc: undefined,
        ai: undefined,
        phone: undefined,
        phoneAlt: undefined,
        email: undefined,
        address: undefined,
        wilayaCode: undefined,
        commune: undefined,
        employer: undefined,
        monthlyIncomeCents: undefined,
        notes: undefined,
      }),
    );
    expect(partner.ok).toBe(true);
    partnerId = partner.ok ? partner.value.id : '';
  });

  it('confirms a sale order and creates one draft delivery for it', async () => {
    const created = await withTenant(args, (ctx) =>
      createSaleOrder(ctx, {
        partnerId,
        orderDate: '2026-10-01',
        lines: [{ productId, description: 'Cement bag', quantity: '2', unitPrice: '1000', discount: '0', taxId: null }],
      }),
    );
    expect(created.ok).toBe(true);
    saleOrderId = created.ok ? created.value.id : '';
    const confirmed = await withTenant(args, (ctx) => confirmSaleOrder(ctx, saleOrderId));
    expect(confirmed.ok).toBe(true);

    const rows = await db
      .select()
      .from(deliveries)
      .where(
        and(
          eq(deliveries.companyId, companyId),
          eq(deliveries.sourceEntity, 'sales.order'),
          eq(deliveries.sourceId, saleOrderId),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe('draft');
    const lines = await db.select().from(deliveryLines).where(eq(deliveryLines.deliveryId, rows[0]?.id ?? ''));
    expect(lines.some((l) => l.productId === productId)).toBe(true);
    const moves = await db
      .select()
      .from(stockMoves)
      .where(and(eq(stockMoves.companyId, companyId), eq(stockMoves.sourceId, saleOrderId)));
    expect(moves).toHaveLength(0);
  });

  it('invoices and posts the sale, and books a balanced journal entry', async () => {
    const invoice = await withTenant(args, (ctx) => createInvoiceFromOrder(ctx, saleOrderId));
    expect(invoice.ok).toBe(true);
    invoiceId = invoice.ok ? invoice.value.invoiceId : '';
    const posted = await withTenant(args, (ctx) => postInvoice(ctx, invoiceId));
    expect(posted.ok).toBe(true);

    const entries = await db
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.companyId, companyId),
          eq(journalEntries.sourceEntity, 'invoicing.invoice'),
          eq(journalEntries.sourceId, invoiceId),
        ),
      );
    expect(entries).toHaveLength(1);
    const lines = await db
      .select({ debit: journalLines.debitCents, credit: journalLines.creditCents })
      .from(journalLines)
      .where(inArray(journalLines.entryId, entries.map((e) => e.id)));
    expect(lines.length).toBeGreaterThan(0);
    const debit = lines.reduce((sum, l) => sum + l.debit, BigInt(0));
    const credit = lines.reduce((sum, l) => sum + l.credit, BigInt(0));
    expect(debit).toBe(credit);
  });

  it('registers a cash payment and books its entry', async () => {
    const paid = await withTenant(args, (ctx) =>
      registerPayment(ctx, invoiceId, { amountCents: BigInt(200000), method: 'cash' }),
    );
    expect(paid.ok).toBe(true);
    const paymentId = paid.ok ? paid.value.paymentId : '';
    const entries = await db
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.companyId, companyId),
          eq(journalEntries.sourceEntity, 'invoicing.payment'),
          eq(journalEntries.sourceId, paymentId),
        ),
      );
    expect(entries).toHaveLength(1);
  });

  it('settles 411 on a cash payment that carries timbre, with balanced entries', async () => {
    // 1000 DA invoice. Paying 1001 DA in cash adds 1 DA timbre (tier 300 to 30 000 DA), so the invoice total
    // becomes 1001 DA and the payment settles it exactly.
    const created = await withTenant(args, (ctx) =>
      createSaleOrder(ctx, {
        partnerId,
        orderDate: '2026-10-02',
        lines: [{ productId, description: 'Cement bag', quantity: '1', unitPrice: '1000', discount: '0', taxId: null }],
      }),
    );
    expect(created.ok).toBe(true);
    const orderId = created.ok ? created.value.id : '';
    expect((await withTenant(args, (ctx) => confirmSaleOrder(ctx, orderId))).ok).toBe(true);
    const invoice = await withTenant(args, (ctx) => createInvoiceFromOrder(ctx, orderId));
    expect(invoice.ok).toBe(true);
    const newInvoiceId = invoice.ok ? invoice.value.invoiceId : '';
    expect((await withTenant(args, (ctx) => postInvoice(ctx, newInvoiceId))).ok).toBe(true);

    const paid = await withTenant(args, (ctx) =>
      registerPayment(ctx, newInvoiceId, { amountCents: BigInt(100100), method: 'cash' }),
    );
    expect(paid.ok).toBe(true);
    const paymentId = paid.ok ? paid.value.paymentId : '';

    const [invoiceRow] = await db
      .select({ totalCents: invoices.totalCents, stampCents: invoices.stampCents, paymentState: invoices.paymentState })
      .from(invoices)
      .where(eq(invoices.id, newInvoiceId));
    expect(invoiceRow?.stampCents).toBe(BigInt(100));
    expect(invoiceRow?.paymentState).toBe('paid');

    const entryRows = await db
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.companyId, companyId),
          inArray(journalEntries.sourceId, [newInvoiceId, paymentId]),
        ),
      );
    const lines = await db
      .select({ code: accounts.code, debit: journalLines.debitCents, credit: journalLines.creditCents })
      .from(journalLines)
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(inArray(journalLines.entryId, entryRows.map((e) => e.id)));
    const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, BigInt(0));
    const debit411 = sum(lines.filter((l) => l.code === '411').map((l) => l.debit));
    const credit411 = sum(lines.filter((l) => l.code === '411').map((l) => l.credit));
    expect(debit411).toBe(BigInt(100000));
    expect(credit411).toBe(debit411);
    expect(sum(lines.filter((l) => l.code === '445').map((l) => l.credit))).toBe(BigInt(100));
    expect(sum(lines.map((l) => l.debit))).toBe(sum(lines.map((l) => l.credit)));
  });

  it('activates an instalment contract, records a receipt, and books both entries balanced', async () => {
    const draft = await withTenant(args, (ctx) =>
      createDraftContract(ctx, {
        partnerId,
        lines: [{ description: 'Fridge', quantity: '1', unitPriceCents: BigInt(100000) }],
        downPaymentCents: BigInt(0),
        markupRate: '20',
        installmentsCount: 2,
        frequency: 'monthly',
        startDate: '2026-11-01',
      }),
    );
    expect(draft.ok).toBe(true);
    const contractId = draft.ok ? draft.value.id : '';
    const activated = await withTenant(args, (ctx) => activateContract(ctx, contractId));
    expect(activated.ok).toBe(true);

    const activation = await db
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.companyId, companyId),
          eq(journalEntries.sourceEntity, 'credit_sales.contract'),
          eq(journalEntries.sourceId, contractId),
        ),
      );
    expect(activation).toHaveLength(1);

    const receipt = await withTenant(args, (ctx) =>
      recordPayment(ctx, { contractId, amountCents: BigInt(50000), method: 'cash' }),
    );
    expect(receipt.ok).toBe(true);
    const paymentId = receipt.ok ? receipt.value.paymentId : '';
    const payment = await db
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.companyId, companyId),
          eq(journalEntries.sourceEntity, 'credit_sales.payment'),
          eq(journalEntries.sourceId, paymentId),
        ),
      );
    expect(payment).toHaveLength(1);

    const lines = await db
      .select({ code: accounts.code, debit: journalLines.debitCents, credit: journalLines.creditCents })
      .from(journalLines)
      .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(inArray(journalLines.entryId, [...activation, ...payment].map((e) => e.id)));
    const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, BigInt(0));
    expect(sum(lines.map((l) => l.debit))).toBe(sum(lines.map((l) => l.credit)));
    // 411 owed: 120 000 DA total (100 000 cash + 20 000 markup), less the 50 000 receipt.
    const net411 = sum(lines.filter((l) => l.code === '411').map((l) => l.debit)) -
      sum(lines.filter((l) => l.code === '411').map((l) => l.credit));
    expect(net411).toBe(BigInt(70000));
  });

  it('receives a purchase order and increases stock', async () => {
    const before = await withTenant(args, (ctx) => onHandByLocation(ctx, { productId }));
    const stockBefore = before.reduce((sum, r) => sum + Number(r.quantity), 0);

    const created = await withTenant(args, (ctx) =>
      createPurchaseOrder(ctx, {
        partnerId,
        expectedDate: null,
        note: null,
        lines: [{ productId, description: 'Cement bag', quantity: '5', unitPriceCents: BigInt(50000), taxId: null }],
      }),
    );
    expect(created.ok).toBe(true);
    const orderId = created.ok ? created.value.id : '';
    const confirmed = await withTenant(args, (ctx) => confirmPurchaseOrder(ctx, orderId));
    expect(confirmed.ok).toBe(true);
    const received = await withTenant(args, (ctx) => receiveOrder(ctx, orderId));
    expect(received.ok).toBe(true);

    const after = await withTenant(args, (ctx) => onHandByLocation(ctx, { productId }));
    const stockAfter = after.reduce((sum, r) => sum + Number(r.quantity), 0);
    expect(stockAfter).toBe(stockBefore + 5);
  });
});
