import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import type { Ctx } from '@/core/ctx';
import { partners } from '../schema';
import {
  archivePartner,
  createPartner,
  getPartner,
  listPartners,
  partnerOptions,
  updatePartner,
  type PartnerInput,
} from '../service/partners';
import { parseListQuery } from '@/core/entities/list-query';
import { partnerEntity } from '../entities';

loadDevEnv();

const db = getDb();
const userId = randomUUID();
const companyA = randomUUID();
const companyB = randomUUID();
const PERMS = new Set(['contacts.partner.read', 'contacts.partner.write']);

const argsFor = (companyId: string, perms: ReadonlySet<string> = PERMS): TenantArgs => ({
  userId,
  companyId,
  perms,
  locale: 'en',
});

function input(overrides: Partial<PartnerInput> = {}): PartnerInput {
  return {
    kind: 'individual',
    isCustomer: true,
    isSupplier: false,
    isProspect: false,
    firstName: 'Karim',
    lastName: 'Haddad',
    phone: '0661 00 00 01',
    companyName: undefined,
    nif: undefined,
    nis: undefined,
    rc: undefined,
    ai: undefined,
    phoneAlt: undefined,
    email: undefined,
    address: undefined,
    wilayaCode: undefined,
    commune: undefined,
    employer: undefined,
    monthlyIncomeCents: undefined,
    notes: undefined,
    ...overrides,
  };
}

beforeAll(async () => {
  await db.insert(users).values({
    id: userId,
    name: 'Contacts test',
    email: `contacts-${userId}@test.invalid`,
  });
  await db.insert(companies).values([
    { id: companyA, legalName: 'Contacts A', displayName: 'Contacts A' },
    { id: companyB, legalName: 'Contacts B', displayName: 'Contacts B' },
  ]);
});

afterAll(async () => {
  // audit_log is append-only, so audit rows stay. Partner rows are removed when possible.
  try {
    await db.delete(partners).where(inArray(partners.companyId, [companyA, companyB]));
    await db.delete(companies).where(inArray(companies.id, [companyA, companyB]));
  } catch {
    // Audit rows reference the company, so cleanup can be refused. The rows keep random uuids.
  }
});

async function run<T>(
  companyId: string,
  fn: (ctx: Ctx) => Promise<T>,
  perms?: ReadonlySet<string>,
): Promise<T> {
  return withTenant(argsFor(companyId, perms), fn);
}

describe('contacts partner service', () => {
  it('creates, gets and lists a partner', async () => {
    const created = await run(companyA, (ctx) => createPartner(ctx, input({ notes: 'first' })));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.value.id;

    const got = await run(companyA, (ctx) => getPartner(ctx, id));
    expect(got.ok && got.value.displayName).toBe('Karim Haddad');
    expect(got.ok && got.value.phone).toBe('+213661000001');

    const listed = await run(companyA, (ctx) =>
      listPartners(ctx, parseListQuery({ q: 'haddad' }, partnerEntity)),
    );
    expect(listed.ok && listed.value.rows.some((r) => r.id === id)).toBe(true);
  });

  it('searches by name, phone and NIF', async () => {
    const created = await run(companyA, (ctx) =>
      createPartner(ctx, input({ firstName: 'Lynda', lastName: 'Zerrouki', nif: 'NIF-SEARCH-1' })),
    );
    expect(created.ok).toBe(true);
    const byNif = await run(companyA, (ctx) =>
      listPartners(ctx, parseListQuery({ q: 'SEARCH-1' }, partnerEntity)),
    );
    expect(byNif.ok && byNif.value.total).toBeGreaterThanOrEqual(1);
    const byName = await run(companyA, (ctx) =>
      listPartners(ctx, parseListQuery({ q: 'Zerrouki' }, partnerEntity)),
    );
    expect(byName.ok && byName.value.rows.length).toBe(1);
  });

  it('updates a partner and writes the new display name', async () => {
    const created = await run(companyA, (ctx) => createPartner(ctx, input({ firstName: 'Old', lastName: 'Name' })));
    if (!created.ok) throw new Error('create failed');
    const id = created.value.id;

    const updated = await run(companyA, (ctx) =>
      updatePartner(ctx, id, input({ firstName: 'New', lastName: 'Name', phone: '0550000002' })),
    );
    expect(updated.ok).toBe(true);
    const got = await run(companyA, (ctx) => getPartner(ctx, id));
    expect(got.ok && got.value.displayName).toBe('New Name');
    expect(got.ok && got.value.phone).toBe('+213550000002');
  });

  it('archives a partner and hides it from options', async () => {
    const created = await run(companyA, (ctx) =>
      createPartner(ctx, input({ firstName: 'Arch', lastName: 'Ivable' })),
    );
    if (!created.ok) throw new Error('create failed');
    const id = created.value.id;

    const before = await run(companyA, (ctx) => partnerOptions(ctx, 'Ivable'));
    expect(before.ok && before.value.length).toBe(1);

    const archived = await run(companyA, (ctx) => archivePartner(ctx, id));
    expect(archived.ok).toBe(true);
    const got = await run(companyA, (ctx) => getPartner(ctx, id));
    expect(got.ok && got.value.active).toBe(false);

    const after = await run(companyA, (ctx) => partnerOptions(ctx, 'Ivable'));
    expect(after.ok && after.value.length).toBe(0);
  });

  it('rejects a duplicate NIF in the same company with CONFLICT', async () => {
    const first = await run(companyA, (ctx) => createPartner(ctx, input({ nif: 'DUP-NIF-1' })));
    expect(first.ok).toBe(true);
    const second = await run(companyA, (ctx) =>
      createPartner(ctx, input({ firstName: 'Other', nif: 'DUP-NIF-1' })),
    );
    expect(second.ok ? null : second.error.code).toBe('CONFLICT');
  });

  it('isolates companies: another company cannot read or see the partner', async () => {
    const created = await run(companyA, (ctx) =>
      createPartner(ctx, input({ firstName: 'Isol', lastName: 'Ated' })),
    );
    if (!created.ok) throw new Error('create failed');
    const id = created.value.id;

    const other = await run(companyB, (ctx) => getPartner(ctx, id));
    expect(other.ok ? null : other.error.code).toBe('NOT_FOUND');
    const list = await run(companyB, (ctx) =>
      listPartners(ctx, parseListQuery({ q: 'Isol' }, partnerEntity)),
    );
    expect(list.ok && list.value.total).toBe(0);
  });

  it('returns FORBIDDEN without the write permission', async () => {
    const readOnly = new Set(['contacts.partner.read']);
    const result = await run(companyA, (ctx) => createPartner(ctx, input()), readOnly);
    expect(result.ok ? null : result.error.code).toBe('FORBIDDEN');
  });
});
