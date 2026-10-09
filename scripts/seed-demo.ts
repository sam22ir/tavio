// Seeds a clearly fictional demo company ("Électroménager El Baraka", Sétif) for marketing screenshots.
// Idempotent: each block only adds what is missing, nothing is deleted.
// Run with: ./node_modules/.bin/tsx scripts/seed-demo.ts
// Demo login comes from ~/.config/tavio/demo-account.env (DEMO_EMAIL, DEMO_PASSWORD). Never printed.
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { getAuth } from '../src/core/auth/server';
import { getDb } from '../src/core/db/client';
import { withTenant } from '../src/core/db/tenant';
import { companies } from '../src/core/db/schema/tenancy';
import { users } from '../src/core/db/schema/auth';
import type { Ctx } from '../src/core/ctx';
import { loadDevEnv } from '../src/core/env/load-dev-env';
import type { Result } from '../src/core/result';
import { createCompany, listMyCompanies, loadTenantArgs } from '../src/core/tenancy/service';
import { loadAlgerianDefaults, taxOptions } from '../src/modules/l10n_dz/service/taxes';
import { partners } from '../src/modules/contacts/schema';
import { createPartner, type PartnerInput } from '../src/modules/contacts/service/partners';
import { products, uoms } from '../src/modules/products/schema';
import { createProduct, type ProductInput } from '../src/modules/products/service/products';
import { ensureDefaultWarehouse } from '../src/modules/inventory/service/warehouses';
import { createOrder, confirmOrder as confirmPurchase, receiveOrder, type OrderLineInput } from '../src/modules/purchases/service/orders';
import { purchaseOrders } from '../src/modules/purchases/schema';
import { createSaleOrder, confirmOrder as confirmSale } from '../src/modules/sales/service/orders';
import { saleOrders } from '../src/modules/sales/schema';
import { createInvoice, type NewInvoiceLine } from '../src/modules/invoicing/service/create';
import { loadInvoice, postInvoice, registerPayment } from '../src/modules/invoicing/service/invoices';
import { invoices } from '../src/modules/invoicing/schema';
import { ensureDefaultPipeline, listStages } from '../src/modules/crm/service/pipeline';
import { createLead, type LeadInput } from '../src/modules/crm/service/leads';
import { leads } from '../src/modules/crm/schema';
import {
  activateContract,
  createDraftContract,
  getContract,
  type DraftContractInput,
} from '../src/modules/credit_sales/service/contracts';
import { listOverdue, recordPayment, type PaymentMethod } from '../src/modules/credit_sales/service/payments';
import { creditContracts } from '../src/modules/credit_sales/schema';
import { ensureActivity, postMessage } from '../src/modules/chatter/service';

loadDevEnv();

const COMPANY_NAME = 'Électroménager El Baraka';
const DEMO_NAME = 'Karim Benali';
const COMPANY_PHONE = '036 00 00 00';
const COMPANY_ADDRESS = 'Cité 1000 logements, Sétif';
const COMPANY_WILAYA = '19';
const COMPANY_NIF = '000019000000000';
const COMPANY_RC = '19/00-0000000 B 00';
const CONTRACT_ENTITY = 'credit_sales.contract';
const TARGET_LEADS = 8;

interface DemoCredentials {
  email: string;
  password: string;
}

// Reads KEY=VALUE lines. Values are returned to the caller only, never logged.
function readDemoCredentials(): DemoCredentials {
  const file = path.join(os.homedir(), '.config', 'tavio', 'demo-account.env');
  if (!existsSync(file)) throw new Error('demo account file missing');
  const values = new Map<string, string>();
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const sep = line.indexOf('=');
    if (sep < 1) continue;
    let value = line.slice(sep + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values.set(line.slice(0, sep).trim(), value);
  }
  const email = values.get('DEMO_EMAIL');
  const password = values.get('DEMO_PASSWORD');
  if (!email || !password) throw new Error('DEMO_EMAIL or DEMO_PASSWORD missing');
  return { email, password };
}

function must<T>(result: Result<T>, step: string): T {
  if (!result.ok) throw new Error(`${step} failed: ${result.error.code}`);
  return result.value;
}

const DAY_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' });
const todayIso = (): string => DAY_FMT.format(new Date());

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Due dates fall on the 5th of each month, counted from the first due date.
function addMonthsOn5th(iso: string, months: number): string {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + months, 5)).toISOString().slice(0, 10);
}

const dzd = (amount: number): bigint => BigInt(amount) * BigInt(100);

interface CustomerSeed {
  firstName: string;
  lastName: string;
  phone: string;
  wilayaCode: string;
  commune: string;
}

const CUSTOMERS: CustomerSeed[] = [
  { firstName: 'Yacine', lastName: 'Mansouri', phone: '0551 23 45 67', wilayaCode: '19', commune: 'Sétif' },
  { firstName: 'Amina', lastName: 'Belkacem', phone: '0662 11 08 34', wilayaCode: '19', commune: 'El Eulma' },
  { firstName: 'Sofiane', lastName: 'Haddad', phone: '0770 46 12 90', wilayaCode: '19', commune: 'Aïn Oulmène' },
  { firstName: 'Nadia', lastName: 'Cherif', phone: '0555 78 20 14', wilayaCode: '19', commune: 'Sétif' },
  { firstName: 'Rachid', lastName: 'Bouzid', phone: '0660 35 91 02', wilayaCode: '06', commune: 'Béjaïa' },
  { firstName: 'Fatima Zohra', lastName: 'Hamdi', phone: '0773 19 84 27', wilayaCode: '19', commune: 'Bougaa' },
  { firstName: 'Karim', lastName: 'Ferhat', phone: '0558 62 41 75', wilayaCode: '04', commune: 'Oum El Bouaghi' },
  { firstName: 'Lamia', lastName: 'Brahimi', phone: '0664 90 27 53', wilayaCode: '18', commune: 'Jijel' },
  { firstName: 'Hakim', lastName: 'Djebbar', phone: '0779 05 36 48', wilayaCode: '19', commune: 'Sétif' },
  { firstName: 'Samira', lastName: 'Taleb', phone: '0552 84 17 36', wilayaCode: '05', commune: 'Batna' },
  { firstName: 'Mehdi', lastName: 'Laib', phone: '0661 47 52 08', wilayaCode: '19', commune: 'Sétif' },
  { firstName: 'Soraya', lastName: 'Kaci', phone: '0774 33 68 19', wilayaCode: '25', commune: 'Constantine' },
  { firstName: 'Walid', lastName: 'Meziane', phone: '0556 26 09 81', wilayaCode: '28', commune: "M'Sila" },
  { firstName: 'Ilyes', lastName: 'Ouali', phone: '0663 58 74 12', wilayaCode: '19', commune: 'Ain Azel' },
  { firstName: 'Djamila', lastName: 'Hadj', phone: '0771 12 65 49', wilayaCode: '24', commune: 'Guelma' },
];

interface ProductSeed {
  name: string;
  sku: string;
  salePriceDzd: number;
  costDzd: number;
}

const PRODUCTS: ProductSeed[] = [
  { name: 'Réfrigérateur Condor 400L', sku: 'EB-FRI-001', salePriceDzd: 95000, costDzd: 78000 },
  { name: 'Climatiseur Iris 12000 BTU', sku: 'EB-CLI-002', salePriceDzd: 68000, costDzd: 55000 },
  { name: 'Machine à laver Brandt 8kg', sku: 'EB-LAV-003', salePriceDzd: 82000, costDzd: 68000 },
  { name: 'Téléviseur Condor 55" 4K', sku: 'EB-TV-004', salePriceDzd: 110000, costDzd: 92000 },
  { name: 'Cuisinière Enie 4 feux', sku: 'EB-CUI-005', salePriceDzd: 46000, costDzd: 37000 },
  { name: 'Congélateur Samsung 300L', sku: 'EB-CON-006', salePriceDzd: 88000, costDzd: 72000 },
  { name: 'Micro-ondes LG 25L', sku: 'EB-MIC-007', salePriceDzd: 18500, costDzd: 14000 },
  { name: 'Salon 5 places', sku: 'EB-SAL-008', salePriceDzd: 120000, costDzd: 90000 },
  { name: 'Lit 2 places avec armoire', sku: 'EB-LIT-009', salePriceDzd: 74000, costDzd: 58000 },
  { name: 'Smartphone Samsung Galaxy A55', sku: 'EB-PHO-010', salePriceDzd: 92000, costDzd: 80000 },
  { name: 'Chauffe-eau électrique 80L', sku: 'EB-CHE-011', salePriceDzd: 24000, costDzd: 18000 },
  { name: 'Aspirateur Brandt 1800W', sku: 'EB-ASP-012', salePriceDzd: 9500, costDzd: 7000 },
];

// Credit plan. fullPaid counts installments paid in full from the first due date. partial pays half of the next one.
interface ContractPlan {
  customer: number;
  product: number;
  startMonthsAgo: number;
  count: number;
  fullPaid: number;
  partial: boolean;
}

const CONTRACT_PLAN: ContractPlan[] = [
  { customer: 0, product: 0, startMonthsAgo: 8, count: 8, fullPaid: 8, partial: false },
  { customer: 1, product: 2, startMonthsAgo: 6, count: 8, fullPaid: 7, partial: false },
  { customer: 2, product: 3, startMonthsAgo: 5, count: 10, fullPaid: 6, partial: false },
  { customer: 3, product: 4, startMonthsAgo: 4, count: 8, fullPaid: 3, partial: true },
  { customer: 4, product: 5, startMonthsAgo: 3, count: 6, fullPaid: 2, partial: true },
  { customer: 5, product: 6, startMonthsAgo: 2, count: 6, fullPaid: 3, partial: false },
  { customer: 6, product: 7, startMonthsAgo: 1, count: 6, fullPaid: 1, partial: false },
  { customer: 7, product: 8, startMonthsAgo: 2, count: 10, fullPaid: 2, partial: false },
  { customer: 8, product: 9, startMonthsAgo: 7, count: 12, fullPaid: 8, partial: false },
  { customer: 9, product: 10, startMonthsAgo: 1, count: 4, fullPaid: 1, partial: false },
];

const PAYMENT_METHODS: readonly PaymentMethod[] = ['cash', 'ccp', 'transfer', 'cash', 'edahabia', 'ccp'];

async function ensureUser(credentials: DemoCredentials): Promise<string> {
  const db = getDb();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${credentials.email})`);
  if (existing) return existing.id;

  const auth = getAuth();
  const result = await auth.api.signUpEmail({
    body: { name: DEMO_NAME, email: credentials.email, password: credentials.password },
  });
  if (!result?.user?.id) throw new Error('demo user creation failed');
  return result.user.id;
}

async function ensureCompany(userId: string): Promise<string> {
  const db = getDb();
  const mine = await listMyCompanies(userId);
  const found = mine.find((c) => c.name === COMPANY_NAME);
  let companyId: string;
  if (found) {
    companyId = found.id;
  } else {
    const created = must(
      await createCompany(userId, {
        legalName: COMPANY_NAME,
        phone: COMPANY_PHONE,
        address: COMPANY_ADDRESS,
        wilayaCode: COMPANY_WILAYA,
      }),
      'create company',
    );
    companyId = created.companyId;
  }
  // Fictional tax identifiers. createCompany has no input for them, so they are filled only when empty.
  await db
    .update(companies)
    .set({ nif: COMPANY_NIF, rc: COMPANY_RC })
    .where(sql`${companies.id} = ${companyId} and ${companies.nif} is null`);
  return companyId;
}

async function seedPartners(ctx: Ctx): Promise<{ partnerIds: Map<string, string>; supplierId: string }> {
  const existing = await ctx.tx
    .select({ id: partners.id, firstName: partners.firstName, lastName: partners.lastName, companyName: partners.companyName })
    .from(partners)
    .where(eq(partners.companyId, ctx.companyId));
  const partnerIds = new Map<string, string>();
  for (const row of existing) {
    const key = row.companyName ?? `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim();
    partnerIds.set(key, row.id);
  }

  for (const c of CUSTOMERS) {
    const key = `${c.firstName} ${c.lastName}`;
    if (partnerIds.has(key)) continue;
    const input: PartnerInput = {
      kind: 'individual',
      isCustomer: true,
      isSupplier: false,
      isProspect: false,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      wilayaCode: c.wilayaCode,
      commune: c.commune,
      address: `${c.commune}`,
    };
    partnerIds.set(key, must(await createPartner(ctx, input), `partner ${key}`).id);
  }

  const supplierName = 'SARL Condor Distribution Est';
  let supplierId = partnerIds.get(supplierName);
  if (!supplierId) {
    const input: PartnerInput = {
      kind: 'company',
      isCustomer: false,
      isSupplier: true,
      isProspect: false,
      companyName: supplierName,
      nif: '000025000000000',
      phone: '031 00 00 00',
      wilayaCode: '25',
      commune: 'Constantine',
      address: 'Zone industrielle, Constantine',
    };
    supplierId = must(await createPartner(ctx, input), 'supplier').id;
    partnerIds.set(supplierName, supplierId);
  }
  return { partnerIds, supplierId };
}

async function seedProducts(ctx: Ctx): Promise<string[]> {
  const [unit] = await ctx.tx.select({ id: uoms.id }).from(uoms).where(eq(uoms.code, 'unit'));
  if (!unit) throw new Error('uom "unit" missing: run pnpm db:seed first');
  const existing = await ctx.tx
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.companyId, ctx.companyId));
  const ids = new Map(existing.map((p) => [p.name, p.id]));
  for (const p of PRODUCTS) {
    if (ids.has(p.name)) continue;
    const input: ProductInput = {
      name: p.name,
      nameAr: null,
      sku: p.sku,
      barcode: null,
      categoryId: null,
      kind: 'goods',
      uomId: unit.id,
      salePriceCents: String(p.salePriceDzd),
      costCents: String(p.costDzd),
      trackStock: true,
      active: true,
      description: null,
    };
    ids.set(p.name, must(await createProduct(ctx, input), `product ${p.name}`).id);
  }
  return PRODUCTS.map((p) => {
    const id = ids.get(p.name);
    if (!id) throw new Error('product id missing');
    return id;
  });
}

async function seedStock(ctx: Ctx, supplierId: string, productIds: string[]): Promise<void> {
  const existing = await ctx.tx
    .select({ id: purchaseOrders.id })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.companyId, ctx.companyId));
  if (existing.length > 0) return;
  await ensureDefaultWarehouse(ctx);
  const lines: OrderLineInput[] = PRODUCTS.map((p, i) => ({
    productId: productIds[i] ?? null,
    description: p.name,
    quantity: '10',
    unitPriceCents: dzd(p.costDzd),
    taxId: null,
  }));
  const order = must(
    await createOrder(ctx, { partnerId: supplierId, expectedDate: todayIso(), note: 'Réapprovisionnement initial', lines }),
    'purchase order',
  );
  must(await confirmPurchase(ctx, order.id), 'confirm purchase');
  must(await receiveOrder(ctx, order.id), 'receive purchase');
}

async function seedSales(ctx: Ctx, partnerIds: Map<string, string>, productIds: string[], taxId: string | undefined): Promise<void> {
  const existing = await ctx.tx.select({ id: saleOrders.id }).from(saleOrders).where(eq(saleOrders.companyId, ctx.companyId));
  if (existing.length > 0) return;
  const orders = [
    { customer: 0, product: 0, daysAgo: 21 },
    { customer: 5, product: 6, daysAgo: 9 },
    { customer: 10, product: 1, daysAgo: 3 },
  ];
  for (const o of orders) {
    const partnerId = customerId(partnerIds, o.customer);
    const product = PRODUCTS[o.product];
    if (!product) throw new Error('product index out of range');
    const created = must(
      await createSaleOrder(ctx, {
        partnerId,
        orderDate: addDays(todayIso(), -o.daysAgo),
        validityDate: null,
        note: null,
        lines: [
          {
            productId: productIds[o.product] ?? null,
            description: product.name,
            quantity: '1',
            unitPrice: String(product.salePriceDzd),
            discount: '0',
            taxId: taxId ?? null,
          },
        ],
      }),
      'sale order',
    );
    must(await confirmSale(ctx, created.id), 'confirm sale');
  }
}

async function seedInvoices(ctx: Ctx, partnerIds: Map<string, string>, productIds: string[], taxId: string | undefined): Promise<void> {
  const existing = await ctx.tx
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.companyId, ctx.companyId));
  if (existing.length > 0) return;
  const specs = [
    { customer: 2, product: 5, paidByTransfer: true, daysAgo: 14 },
    { customer: 8, product: 7, paidByTransfer: false, daysAgo: 4 },
  ];
  for (const s of specs) {
    const product = PRODUCTS[s.product];
    if (!product) throw new Error('product index out of range');
    const line: NewInvoiceLine = {
      productId: productIds[s.product] ?? null,
      description: product.name,
      quantity: '1',
      unitPriceCents: dzd(product.salePriceDzd),
      taxId: taxId ?? null,
    };
    const draft = must(
      await createInvoice(ctx, {
        type: 'out_invoice',
        partnerId: customerId(partnerIds, s.customer),
        date: addDays(todayIso(), -s.daysAgo),
        dueDate: addDays(todayIso(), 30 - s.daysAgo),
        lines: [line],
      }),
      'invoice draft',
    );
    must(await postInvoice(ctx, draft.id), 'post invoice');
    if (s.paidByTransfer) {
      const loaded = must(await loadInvoice(ctx, draft.id), 'load invoice');
      must(
        await registerPayment(ctx, draft.id, {
          amountCents: loaded.invoice.totalCents,
          method: 'transfer',
          date: addDays(todayIso(), -s.daysAgo + 3),
          reference: 'VIR-2026-0412',
        }),
        'register invoice payment',
      );
    }
  }
}

async function seedLeads(ctx: Ctx, partnerIds: Map<string, string>): Promise<void> {
  const existing = await ctx.tx.select({ id: leads.id }).from(leads).where(eq(leads.companyId, ctx.companyId));
  if (existing.length >= TARGET_LEADS) return;
  const pipelineId = must(await ensureDefaultPipeline(ctx), 'pipeline').id;
  const stages = must(await listStages(ctx, pipelineId), 'stages');
  if (stages.length === 0) throw new Error('pipeline has no stages');
  const specs: { name: string; customer: number; revenueDzd: number; probability: number; stage: number; source: LeadInput['source']; daysToClose: number }[] = [
    { name: 'Salon et cuisine pour nouvel appartement', customer: 10, revenueDzd: 210000, probability: 20, stage: 0, source: 'facebook', daysToClose: 40 },
    { name: 'Équipement complet cuisine', customer: 11, revenueDzd: 135000, probability: 40, stage: 1, source: 'whatsapp', daysToClose: 25 },
    { name: 'Climatisation deux chambres', customer: 12, revenueDzd: 136000, probability: 50, stage: 1, source: 'walk_in', daysToClose: 15 },
    { name: 'Téléviseur et salon', customer: 13, revenueDzd: 230000, probability: 60, stage: 2, source: 'referral', daysToClose: 20 },
    { name: 'Chambre à coucher complète', customer: 6, revenueDzd: 74000, probability: 70, stage: 2, source: 'phone', daysToClose: 10 },
    { name: 'Machine à laver et chauffe-eau', customer: 1, revenueDzd: 106000, probability: 80, stage: 3, source: 'instagram', daysToClose: 7 },
    { name: 'Réfrigérateur et congélateur', customer: 3, revenueDzd: 183000, probability: 90, stage: 4, source: 'walk_in', daysToClose: 5 },
    { name: 'Lot électroménager pour bureau', customer: 4, revenueDzd: 58000, probability: 30, stage: 0, source: 'phone', daysToClose: 45 },
  ];
  for (const s of specs.slice(0, TARGET_LEADS)) {
    const stage = stages[s.stage % stages.length];
    if (!stage) throw new Error('stage missing');
    const c = CUSTOMERS[s.customer];
    if (!c) throw new Error('customer index out of range');
    const partnerId = customerId(partnerIds, s.customer);
    must(
      await createLead(ctx, {
        type: 'opportunity',
        name: s.name,
        partnerId,
        contactName: `${c.firstName} ${c.lastName}`,
        phone: c.phone,
        email: `${c.firstName.toLowerCase().replace(/\s+/g, '.')}.${c.lastName.toLowerCase()}@example.com`,
        wilayaCode: c.wilayaCode,
        source: s.source,
        stageId: stage.id,
        probability: s.probability,
        expectedRevenueCents: dzd(s.revenueDzd),
        expectedCloseDate: addDays(todayIso(), s.daysToClose),
        salespersonId: ctx.userId,
        priority: 0,
      }),
      `lead ${s.name}`,
    );
  }
}

function customerId(partnerIds: Map<string, string>, index: number): string {
  const c = CUSTOMERS[index];
  const id = c ? partnerIds.get(`${c.firstName} ${c.lastName}`) : undefined;
  if (!id) throw new Error('customer partner missing');
  return id;
}

async function seedContracts(
  ctx: Ctx,
  partnerIds: Map<string, string>,
  productIds: string[],
): Promise<{ contractIds: string[]; created: number }> {
  const existing = await ctx.tx
    .select({ id: creditContracts.id })
    .from(creditContracts)
    .where(eq(creditContracts.companyId, ctx.companyId));
  const contractIds = existing.map((c) => c.id);
  const before = contractIds.length;
  const today = todayIso();
  for (const [index, plan] of CONTRACT_PLAN.entries()) {
    if (index < contractIds.length) continue;
    const product = PRODUCTS[plan.product];
    if (!product) throw new Error('product index out of range');
    const startDate = addMonthsOn5th(today, -plan.startMonthsAgo);
    const price = dzd(product.salePriceDzd);
    const input: DraftContractInput = {
      partnerId: customerId(partnerIds, plan.customer),
      lines: [{ productId: productIds[plan.product], description: product.name, quantity: '1', unitPriceCents: price }],
      downPaymentCents: price / BigInt(5),
      markupRate: '10',
      installmentsCount: plan.count,
      frequency: 'monthly',
      startDate,
      notes: 'Contrat de démonstration',
    };
    const draft = must(await createDraftContract(ctx, input), `draft contract ${index}`);
    must(await activateContract(ctx, draft.id), `activate contract ${index}`);
    const detail = must(await getContract(ctx, draft.id), `load contract ${index}`);
    const installments = [...detail.installments].sort((a, b) => a.seq - b.seq);

    if (detail.contract.downPaymentCents > BigInt(0)) {
      must(
        await recordPayment(ctx, {
          contractId: draft.id,
          amountCents: detail.contract.downPaymentCents,
          method: 'cash',
          receivedAt: `${addDays(startDate, -1)}T10:00:00Z`,
          isDownPayment: true,
        }),
        `down payment ${index}`,
      );
    }

    const payments: { amountCents: bigint; dueDate: string }[] = [];
    for (let i = 0; i < plan.fullPaid && i < installments.length; i++) {
      const inst = installments[i];
      if (inst) payments.push({ amountCents: inst.amountCents, dueDate: inst.dueDate });
    }
    if (plan.partial) {
      const next = installments[plan.fullPaid];
      if (next) payments.push({ amountCents: next.amountCents / BigInt(2), dueDate: next.dueDate });
    }
    for (const [i, p] of payments.entries()) {
      const received = [addDays(p.dueDate, (i * 3) % 5), today].sort()[0] ?? today;
      must(
        await recordPayment(ctx, {
          contractId: draft.id,
          amountCents: p.amountCents,
          method: PAYMENT_METHODS[(index + i) % PAYMENT_METHODS.length] ?? 'cash',
          receivedAt: `${received}T10:00:00Z`,
          reference: `REF-${index + 1}-${i + 1}`,
        }),
        `payment ${index}-${i}`,
      );
    }
    contractIds.push(draft.id);
  }
  return { contractIds, created: contractIds.length - before };
}

async function seedChatter(ctx: Ctx, contractIds: string[]): Promise<void> {
  const today = todayIso();
  // Notes are not idempotent, so this runs only in the same pass that created the contracts.
  for (const idx of [3, 4]) {
    const recordId = contractIds[idx];
    if (!recordId) continue;
    must(
      await postMessage(ctx, {
        entity: CONTRACT_ENTITY,
        recordId,
        body: 'Client appelé, promesse de paiement reçue pour la fin du mois.',
        kind: 'note',
      }),
      'chatter note',
    );
    must(
      await ensureActivity(ctx, {
        entity: CONTRACT_ENTITY,
        recordId,
        typeKey: 'payment_reminder',
        summary: 'Relancer le client pour les échéances en retard',
        dueDate: addDays(today, 2),
        assigneeId: ctx.userId,
      }),
      'chatter activity',
    );
  }
}

async function main(): Promise<void> {
  const credentials = readDemoCredentials();
  const db = getDb();
  let step = 'user';
  try {
    const userId = await ensureUser(credentials);
    step = 'company';
    const companyId = await ensureCompany(userId);
    const tenant = must(await loadTenantArgs(userId, companyId, 'fr'), 'load tenant');
    const run = <T>(fn: (ctx: Ctx) => Promise<T>): Promise<T> => withTenant(tenant, fn, db);

    step = 'taxes';
    await run((ctx) => loadAlgerianDefaults(ctx).then((r) => must(r, 'taxes')));
    const taxId = await run(async (ctx) => {
      const options = await taxOptions(ctx);
      return (options.find((o) => o.label.includes('19')) ?? options[0])?.value;
    });

    step = 'partners';
    const { partnerIds, supplierId } = await run((ctx) => seedPartners(ctx));

    step = 'products';
    const productIds = await run((ctx) => seedProducts(ctx));

    step = 'stock';
    await run((ctx) => seedStock(ctx, supplierId, productIds));

    step = 'sales';
    await run((ctx) => seedSales(ctx, partnerIds, productIds, taxId));

    step = 'invoices';
    await run((ctx) => seedInvoices(ctx, partnerIds, productIds, taxId));

    step = 'crm';
    await run((ctx) => seedLeads(ctx, partnerIds));

    step = 'contracts';
    const contracts = await run((ctx) => seedContracts(ctx, partnerIds, productIds));

    step = 'chatter';
    if (contracts.created > 0) await run((ctx) => seedChatter(ctx, contracts.contractIds));

    step = 'counts';
    const counts = await run(async (ctx) => {
      const contractRows = await ctx.tx.select({ id: creditContracts.id }).from(creditContracts).where(eq(creditContracts.companyId, ctx.companyId));
      const partnerRows = await ctx.tx.select({ id: partners.id }).from(partners).where(eq(partners.companyId, ctx.companyId));
      const productRows = await ctx.tx.select({ id: products.id }).from(products).where(eq(products.companyId, ctx.companyId));
      const overdue = await listOverdue(ctx);
      return {
        contracts: contractRows.length,
        partners: partnerRows.length,
        products: productRows.length,
        overdue: overdue.length,
      };
    });
    console.log(JSON.stringify(counts));
  } catch (e: unknown) {
    console.error(`db:seed-demo failed at ${step}`, e instanceof Error ? e.name : 'unknown');
    process.exitCode = 1;
  }
}

main().finally(() => process.exit(process.exitCode ?? 0));
