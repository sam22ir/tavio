// Seeds a clearly fictional demo company ("Électroménager El Baraka", Sétif) for marketing screenshots.
// Idempotent: each block only adds what is missing, nothing is deleted.
// Run with: ./node_modules/.bin/tsx scripts/seed-demo.ts
// Demo login comes from ~/.config/tavio/demo-account.env (DEMO_EMAIL, DEMO_PASSWORD). Never printed.
// The sample data itself lives in src/core/demo/sample-data.ts (shared with the onboarding wizard).
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { and, eq, sql } from 'drizzle-orm';
import { getAuth } from '../src/core/auth/server';
import { getDb } from '../src/core/db/client';
import { withTenant } from '../src/core/db/tenant';
import { companies, memberships, roles } from '../src/core/db/schema/tenancy';
import type { Db } from '../src/core/db/types';
import type { TenantArgs } from '../src/core/db/tenant';
import { users } from '../src/core/db/schema/auth';
import { loadDevEnv } from '../src/core/env/load-dev-env';
import { createCompany, listMyCompanies, loadTenantArgs } from '../src/core/tenancy/service';
import { ensureCompanySetup, must, seedCompanyData } from '../src/core/demo/sample-data';
import { repairDemoStock } from '../src/core/demo/repair-stock';
import { repairDemoAccounting } from '../src/core/demo/repair-accounting';
import { partners } from '../src/modules/contacts/schema';
import { products } from '../src/modules/products/schema';
import { creditContracts, creditPayments } from '../src/modules/credit_sales/schema';
import { listOverdue } from '../src/modules/credit_sales/service/payments';
import { invoices as invoiceRows } from '../src/modules/invoicing/schema';
import { leads } from '../src/modules/crm/schema';

loadDevEnv();

const COMPANY_NAME = 'Électroménager El Baraka';
const DEMO_NAME = 'Karim Benali';
const COMPANY_PHONE = '036 00 00 00';
const COMPANY_ADDRESS = 'Cité 1000 logements, Sétif';
const COMPANY_WILAYA = '19';
const COMPANY_NIF = '000019000000000';
const COMPANY_RC = '19/00-0000000 B 00';

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
  await fillTaxIdentifiers(companyId, db);
  return companyId;
}

// Fictional tax identifiers. createCompany has no input for them. Filled only when empty and not already used by
// another company (nif and rc are unique), so a second demo company keeps them blank.
async function fillTaxIdentifiers(companyId: string, db: Db): Promise<void> {
  await db
    .update(companies)
    .set({ nif: COMPANY_NIF, rc: COMPANY_RC })
    .where(
      sql`${companies.id} = ${companyId} and ${companies.nif} is null
        and not exists (select 1 from ${companies} c2 where c2.nif = ${COMPANY_NIF} or c2.rc = ${COMPANY_RC})`,
    );
}

async function companyCounts(tenant: TenantArgs, db: Db): Promise<Record<string, number>> {
  return withTenant(
    tenant,
    async (ctx) => {
      const rowsOf = async (table: typeof partners | typeof products | typeof creditContracts | typeof creditPayments | typeof invoiceRows | typeof leads): Promise<number> =>
        (await ctx.tx.select({ id: table.id }).from(table).where(eq(table.companyId, ctx.companyId))).length;
      const overdue = await listOverdue(ctx);
      return {
        partners: await rowsOf(partners),
        products: await rowsOf(products),
        creditContracts: await rowsOf(creditContracts),
        creditPayments: await rowsOf(creditPayments),
        invoices: await rowsOf(invoiceRows),
        leads: await rowsOf(leads),
        overdueInstallments: overdue.length,
      };
    },
    db,
  );
}

// Company ids from repeatable or comma-separated --company flags.
function parseCompanyArgs(argv: string[]): string[] {
  const ids: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    let raw: string | undefined;
    if (arg === '--company') {
      raw = argv[++i];
      if (!raw) throw new Error('--company needs a value');
    } else if (arg.startsWith('--company=')) {
      raw = arg.slice('--company='.length);
    } else {
      continue;
    }
    for (const part of raw.split(',')) {
      const id = part.trim();
      if (id) ids.push(id);
    }
  }
  for (const id of ids) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('invalid --company id');
  }
  return [...new Set(ids)];
}

// The owner of an existing company is the user whose membership carries the owner role.
async function findOwnerId(companyId: string, db: Db): Promise<string> {
  const [row] = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .where(and(eq(memberships.companyId, companyId), eq(memberships.status, 'active'), eq(roles.key, 'owner')));
  if (!row) throw new Error('owner membership missing');
  return row.userId;
}

async function seedExistingCompany(companyId: string, db: Db, state: { step: string }): Promise<'seeded' | 'skipped'> {
  const userId = await findOwnerId(companyId, db);
  const tenant = must(await loadTenantArgs(userId, companyId, 'fr'), 'load tenant');
  const existing = await withTenant(
    tenant,
    (ctx) => ctx.tx.select({ id: creditContracts.id }).from(creditContracts).where(eq(creditContracts.companyId, ctx.companyId)).limit(1),
    db,
  );
  // Credit contracts are seeded last; every earlier step skips rows it already made, so a half-seeded company resumes.
  if (existing.length > 0) {
    console.log(`${companyId}: skipped (already seeded)`);
    return 'skipped';
  }
  state.step = 'setup';
  await withTenant(tenant, (ctx) => ensureCompanySetup(ctx), db);
  // Real companies keep their own NIF/RC: no fictional tax identifiers here.
  await seedCompanyData(tenant, db, state);
  console.log(`${companyId}: ${JSON.stringify(await companyCounts(tenant, db))}`);
  return 'seeded';
}

// Repairs stock and activity titles of existing companies (see src/core/demo/repair-stock.ts). Idempotent.
async function repairExistingCompany(companyId: string, db: Db): Promise<void> {
  const userId = await findOwnerId(companyId, db);
  const tenant = must(await loadTenantArgs(userId, companyId, 'fr'), 'load tenant');
  const report = await repairDemoStock(tenant, db);
  console.log(`${companyId}: repaired ${JSON.stringify(report)}`);
}

// Posts missing accounting entries of existing documents (see src/core/demo/repair-accounting.ts). Idempotent.
async function repairAccountingForCompany(companyId: string, db: Db): Promise<void> {
  const userId = await findOwnerId(companyId, db);
  const tenant = must(await loadTenantArgs(userId, companyId, 'fr'), 'load tenant');
  const report = await repairDemoAccounting(tenant, db);
  console.log(`${companyId}: accounting ${JSON.stringify(report)}`);
}

async function main(): Promise<void> {
  const db = getDb();
  const argv = process.argv.slice(2);
  if (argv.includes('--repair-accounting')) {
    const targets = parseCompanyArgs(argv);
    if (targets.length === 0) throw new Error('--repair-accounting needs --company=<ids>');
    for (const companyId of targets) {
      try {
        await repairAccountingForCompany(companyId, db);
      } catch (e: unknown) {
        console.error(`repair-accounting failed for ${companyId}`, e instanceof Error ? e.message.slice(0, 200) : 'unknown');
        process.exitCode = 1;
      }
    }
    return;
  }
  if (argv.includes('--repair-stock')) {
    const named = await db.select({ id: companies.id }).from(companies).where(eq(companies.legalName, COMPANY_NAME));
    const targets = parseCompanyArgs(argv);
    if (targets.length === 0) targets.push(...named.map((c) => c.id));
    for (const companyId of targets) {
      try {
        await repairExistingCompany(companyId, db);
      } catch (e: unknown) {
        const cause = e instanceof Error && e.cause instanceof Error ? e.cause.message : '';
        console.error(`repair-stock failed for ${companyId}`, e instanceof Error ? e.message.slice(0, 200) : 'unknown', cause.slice(0, 300));
        process.exitCode = 1;
      }
    }
    return;
  }
  const targets = parseCompanyArgs(argv);
  if (targets.length > 0) {
    for (const companyId of targets) {
      const state = { step: 'company' };
      try {
        const outcome = await seedExistingCompany(companyId, db, state);
        if (outcome === 'seeded') console.log(`${companyId}: seeded`);
      } catch (e: unknown) {
        console.error(`db:seed-demo failed for ${companyId} at ${state.step}`, e instanceof Error ? e.name : 'unknown');
        process.exitCode = 1;
      }
    }
    return;
  }

  const state = { step: 'user' };
  try {
    const credentials = readDemoCredentials();
    const userId = await ensureUser(credentials);
    state.step = 'company';
    const companyId = await ensureCompany(userId);
    const tenant = must(await loadTenantArgs(userId, companyId, 'fr'), 'load tenant');
    await seedCompanyData(tenant, db, state);
    state.step = 'counts';
    console.log(JSON.stringify(await companyCounts(tenant, db)));
  } catch (e: unknown) {
    console.error(`db:seed-demo failed at ${state.step}`, e instanceof Error ? e.name : 'unknown');
    process.exitCode = 1;
  }
}

main().finally(() => process.exit(process.exitCode ?? 0));
