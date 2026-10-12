import { and, asc, count, desc, eq, ilike, ne, or, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { WILAYA_CODE_RE } from '@/core/tenancy/wilayas';
import { z } from 'zod';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import type { ListQuery, ListResult, Row } from '@/core/entities/types';
import { parseDzd } from '@/core/money';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { partners, type NewPartner, type Partner } from '../schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const E164_RE = /^\+[1-9]\d{7,14}$/;
const WILAYA_RE = WILAYA_CODE_RE;
const OPTIONS_LIMIT = 50;
const MAX_PAGE_SIZE = 100;

// Text input: trimmed, empty becomes undefined. Idempotent, so it is safe to re-parse.
const optionalText = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() || undefined : v),
  z.string().max(500).optional(),
);
// Checkbox input: an HTML checkbox sends "on" when checked and nothing otherwise.
const flag = z.preprocess((v) => v === true || v === 'on' || v === 'true', z.boolean());

// Shape validation at the boundary. Business rules live in normalizePartner.
export const partnerInput = z.object({
  kind: z.enum(['individual', 'company']),
  isCustomer: flag,
  isSupplier: flag,
  isProspect: flag,
  firstName: optionalText,
  lastName: optionalText,
  companyName: optionalText,
  nif: optionalText,
  nis: optionalText,
  rc: optionalText,
  ai: optionalText,
  phone: optionalText,
  phoneAlt: optionalText,
  email: z.preprocess((v) => (typeof v === 'string' ? v.trim() || undefined : v), z.email().optional()),
  address: optionalText,
  wilayaCode: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() || undefined : v),
    z.string().regex(WILAYA_RE).optional(),
  ),
  commune: optionalText,
  employer: optionalText,
  // DZD as typed by the user, parsed with parseDzd
  monthlyIncomeCents: optionalText,
  notes: optionalText,
});

export type PartnerInput = z.infer<typeof partnerInput>;

/** Partner as returned to callers. Money is a string of cents so the row is serializable. */
export type PartnerRow = Omit<Partner, 'monthlyIncomeCents'> & { monthlyIncomeCents: string | null };

type PartnerValues = Pick<
  NewPartner,
  | 'kind' | 'isCustomer' | 'isSupplier' | 'isProspect' | 'displayName'
  | 'firstName' | 'lastName' | 'companyName' | 'nif' | 'nis' | 'rc' | 'ai'
  | 'phone' | 'phoneAlt' | 'email' | 'address' | 'wilayaCode' | 'commune'
  | 'employer' | 'monthlyIncomeCents' | 'notes'
>;

/** Normalizes a phone number to E.164. Accepts +213..., 00213..., and local 0XXXXXXXXX (Algeria). */
export function normalizePhone(raw: string): string | null {
  const compact = raw.replace(/[\s.\-()]/g, '');
  let candidate = compact;
  if (compact.startsWith('00')) candidate = `+${compact.slice(2)}`;
  else if (/^0\d{8,9}$/.test(compact)) candidate = `+213${compact.slice(1)}`;
  return E164_RE.test(candidate) ? candidate : null;
}

function validationError(field: string, message: string): Result<never> {
  return err('VALIDATION', message, { field });
}

/** Applies business rules and derived values. Returns the row values to store. */
export function normalizePartner(input: PartnerInput): Result<PartnerValues> {
  if (!input.isCustomer && !input.isSupplier && !input.isProspect) {
    return validationError('isCustomer', 'A partner must be a customer, supplier or prospect');
  }

  let displayName: string;
  let firstName: string | null = null;
  let lastName: string | null = null;
  let companyName: string | null = null;
  if (input.kind === 'individual') {
    if (!input.firstName || !input.lastName) {
      return validationError('firstName', 'First and last name are required for individuals');
    }
    firstName = input.firstName;
    lastName = input.lastName;
    displayName = `${firstName} ${lastName}`;
  } else {
    if (!input.companyName) return validationError('companyName', 'Company name is required');
    companyName = input.companyName;
    displayName = companyName;
  }

  const phone = normalizePartnerPhone(input.phone, 'phone');
  if (!phone.ok) return phone;
  const phoneAlt = normalizePartnerPhone(input.phoneAlt, 'phoneAlt');
  if (!phoneAlt.ok) return phoneAlt;

  let monthlyIncomeCents: bigint | null = null;
  if (input.monthlyIncomeCents !== undefined) {
    const parsed = parseDzd(input.monthlyIncomeCents);
    if (parsed === null) return validationError('monthlyIncomeCents', 'Invalid amount');
    monthlyIncomeCents = parsed;
  }

  return ok({
    kind: input.kind,
    isCustomer: input.isCustomer,
    isSupplier: input.isSupplier,
    isProspect: input.isProspect,
    displayName,
    firstName,
    lastName,
    companyName,
    nif: input.nif ?? null,
    nis: input.nis ?? null,
    rc: input.rc ?? null,
    ai: input.ai ?? null,
    phone: phone.value,
    phoneAlt: phoneAlt.value,
    email: input.email ?? null,
    address: input.address ?? null,
    wilayaCode: input.wilayaCode ?? null,
    commune: input.commune ?? null,
    employer: input.employer ?? null,
    monthlyIncomeCents,
    notes: input.notes ?? null,
  });
}

function normalizePartnerPhone(raw: string | undefined, field: string): Result<string | null> {
  if (raw === undefined) return ok(null);
  const phone = normalizePhone(raw);
  return phone === null ? validationError(field, 'Invalid phone number') : ok(phone);
}

/** Converts cents to a DZD string for form inputs (e.g. 123450 -> "1234.50"). */
export function centsToDzdInput(cents: string | null): string | undefined {
  if (cents === null) return undefined;
  const c = BigInt(cents);
  const whole = c / BigInt(100);
  const frac = (c % BigInt(100)).toString().padStart(2, '0');
  return `${whole}.${frac}`;
}

/** Values for RecordForm defaults. Money is a DZD string. */
export function partnerFormValues(row: PartnerRow): Partial<Row> {
  return { ...row, monthlyIncomeCents: centsToDzdInput(row.monthlyIncomeCents) ?? '' };
}

function toRow(p: Partner): PartnerRow {
  return { ...p, monthlyIncomeCents: p.monthlyIncomeCents === null ? null : p.monthlyIncomeCents.toString() };
}

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const SORT_COLUMNS: Record<string, AnyColumn> = {
  displayName: partners.displayName,
  kind: partners.kind,
  isCustomer: partners.isCustomer,
  isSupplier: partners.isSupplier,
  isProspect: partners.isProspect,
  active: partners.active,
  phone: partners.phone,
  email: partners.email,
  wilayaCode: partners.wilayaCode,
  commune: partners.commune,
};

const BOOLEAN_FILTERS = ['isCustomer', 'isSupplier', 'isProspect', 'active'] as const;

function listWhere(ctx: Ctx, query: ListQuery): SQL | undefined {
  const conditions: SQL[] = [eq(partners.companyId, ctx.companyId)];

  const term = query.q?.trim();
  if (term) {
    const pattern = `%${escapeLike(term)}%`;
    const search = or(
      ilike(partners.displayName, pattern),
      ilike(partners.phone, pattern),
      ilike(partners.nif, pattern),
    );
    if (search) conditions.push(search);
  }

  for (const name of BOOLEAN_FILTERS) {
    const raw = query.filters[name];
    if (raw === 'true' || raw === 'false') {
      conditions.push(eq(partners[name], raw === 'true'));
    }
  }
  if (query.filters.kind === 'individual' || query.filters.kind === 'company') {
    conditions.push(eq(partners.kind, query.filters.kind));
  }
  for (const name of ['wilayaCode', 'commune'] as const) {
    const value = query.filters[name];
    if (value) conditions.push(eq(partners[name], value));
  }

  return and(...conditions);
}

export async function listPartners(ctx: Ctx, query: ListQuery): Promise<Result<ListResult<PartnerRow>>> {
  const perm = requirePerm(ctx, 'contacts.partner.read');
  if (!perm.ok) return perm;

  const where = listWhere(ctx, query);
  const pageSize = Math.min(Math.max(1, query.pageSize), MAX_PAGE_SIZE);
  const page = Math.max(1, query.page);

  const sortColumn = query.sort ? SORT_COLUMNS[query.sort] : undefined;
  const direction = query.dir === 'desc' ? desc : asc;
  const order = sortColumn ? direction(sortColumn) : asc(partners.displayName);

  const [totalRow] = await ctx.tx.select({ n: count() }).from(partners).where(where);
  const rows = await ctx.tx
    .select()
    .from(partners)
    .where(where)
    .orderBy(order, asc(partners.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return ok({ rows: rows.map(toRow), total: Number(totalRow?.n ?? 0), page, pageSize });
}

export async function getPartner(ctx: Ctx, id: string): Promise<Result<PartnerRow>> {
  const perm = requirePerm(ctx, 'contacts.partner.read');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(id)) return err('NOT_FOUND', 'Partner not found');

  const [row] = await ctx.tx
    .select()
    .from(partners)
    .where(and(eq(partners.id, id), eq(partners.companyId, ctx.companyId)))
    .limit(1);
  if (!row) return err('NOT_FOUND', 'Partner not found');
  return ok(toRow(row));
}

/** Rejects NIF, RC or NIS values already used by another partner of this company. */
async function findIdentifierConflict(
  ctx: Ctx,
  values: Pick<PartnerValues, 'nif' | 'rc' | 'nis'>,
  excludeId?: string,
): Promise<Result<void>> {
  const checks: SQL[] = [];
  if (values.nif) checks.push(eq(partners.nif, values.nif));
  if (values.rc) checks.push(eq(partners.rc, values.rc));
  if (values.nis) checks.push(eq(partners.nis, values.nis));
  if (checks.length === 0) return ok(undefined);

  const matches = await ctx.tx
    .select({ nif: partners.nif, rc: partners.rc, nis: partners.nis })
    .from(partners)
    .where(
      and(
        eq(partners.companyId, ctx.companyId),
        or(...checks),
        excludeId ? ne(partners.id, excludeId) : undefined,
      ),
    )
    .limit(1);
  const [match] = matches;
  if (!match) return ok(undefined);

  const field = values.nif && match.nif === values.nif ? 'nif' : values.rc && match.rc === values.rc ? 'rc' : 'nis';
  return err('CONFLICT', `A partner with this ${field.toUpperCase()} already exists`, { field });
}

export async function createPartner(ctx: Ctx, input: PartnerInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'contacts.partner.write');
  if (!perm.ok) return perm;

  const values = normalizePartner(input);
  if (!values.ok) return values;

  const conflict = await findIdentifierConflict(ctx, values.value);
  if (!conflict.ok) return conflict;

  const [created] = await ctx.tx
    .insert(partners)
    .values({ ...values.value, companyId: ctx.companyId, createdBy: ctx.userId })
    .returning();
  if (!created) return err('INTERNAL', 'Insert returned no row');

  await audit(ctx, { entity: 'contacts.partner', recordId: created.id, action: 'create', after: created });
  return ok({ id: created.id });
}

export async function updatePartner(ctx: Ctx, id: string, input: PartnerInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'contacts.partner.write');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(id)) return err('NOT_FOUND', 'Partner not found');

  const [before] = await ctx.tx
    .select()
    .from(partners)
    .where(and(eq(partners.id, id), eq(partners.companyId, ctx.companyId)))
    .for('update')
    .limit(1);
  if (!before) return err('NOT_FOUND', 'Partner not found');

  const values = normalizePartner(input);
  if (!values.ok) return values;

  const conflict = await findIdentifierConflict(ctx, values.value, id);
  if (!conflict.ok) return conflict;

  const [after] = await ctx.tx
    .update(partners)
    .set({ ...values.value, updatedAt: new Date() })
    .where(and(eq(partners.id, id), eq(partners.companyId, ctx.companyId)))
    .returning();
  if (!after) return err('INTERNAL', 'Update returned no row');

  await audit(ctx, { entity: 'contacts.partner', recordId: id, action: 'update', before, after });
  return ok({ id });
}

export async function archivePartner(ctx: Ctx, id: string): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'contacts.partner.write');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(id)) return err('NOT_FOUND', 'Partner not found');

  const [before] = await ctx.tx
    .select()
    .from(partners)
    .where(and(eq(partners.id, id), eq(partners.companyId, ctx.companyId)))
    .for('update')
    .limit(1);
  if (!before) return err('NOT_FOUND', 'Partner not found');
  if (!before.active) return ok({ id });

  const [after] = await ctx.tx
    .update(partners)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(partners.id, id), eq(partners.companyId, ctx.companyId)))
    .returning();
  if (!after) return err('INTERNAL', 'Update returned no row');

  await audit(ctx, { entity: 'contacts.partner', recordId: id, action: 'archive', before, after });
  return ok({ id });
}

/** Active partners for selects in other modules. Max 50 entries. */
export async function partnerOptions(
  ctx: Ctx,
  search?: string,
): Promise<Result<{ value: string; label: string }[]>> {
  const perm = requirePerm(ctx, 'contacts.partner.read');
  if (!perm.ok) return perm;

  const term = search?.trim();
  const conditions: SQL[] = [eq(partners.companyId, ctx.companyId), eq(partners.active, true)];
  if (term) conditions.push(ilike(partners.displayName, `%${escapeLike(term)}%`));

  const rows = await ctx.tx
    .select({ id: partners.id, displayName: partners.displayName })
    .from(partners)
    .where(and(...conditions))
    .orderBy(asc(partners.displayName), asc(partners.id))
    .limit(OPTIONS_LIMIT);

  return ok(rows.map((r) => ({ value: r.id, label: r.displayName })));
}


/** Duplicate keys already stored for this company, for CSV import: `phone:<E.164>` and `nif:<NIF>`. */
export async function partnerDedupeKeys(ctx: Ctx): Promise<Set<string>> {
  const rows = await ctx.tx
    .select({ phone: partners.phone, nif: partners.nif })
    .from(partners)
    .where(eq(partners.companyId, ctx.companyId));
  const keys = new Set<string>();
  for (const r of rows) {
    if (r.phone) keys.add(`phone:${r.phone}`);
    if (r.nif) keys.add(`nif:${r.nif}`);
  }
  return keys;
}

/**
 * Partner for CSV imports (opening balances, quotes). Matches the NIF exactly, the phone after normalizing,
 * or the display name ignoring case. Returns 'ambiguous' when a name matches more than one partner.
 */
export async function findPartnerForImport(
  ctx: Ctx,
  input: { name?: string; phone?: string; nif?: string },
): Promise<{ id: string; displayName: string } | 'ambiguous' | null> {
  const phone = input.phone ? normalizePhone(input.phone) : null;
  const conditions: SQL[] = [];
  if (input.nif) conditions.push(eq(partners.nif, input.nif));
  if (phone) conditions.push(eq(partners.phone, phone));
  if (input.name) conditions.push(sql`lower(${partners.displayName}) = lower(${input.name.trim()})`);
  if (conditions.length === 0) return null;
  const rows = await ctx.tx
    .select({ id: partners.id, displayName: partners.displayName })
    .from(partners)
    .where(and(eq(partners.companyId, ctx.companyId), or(...conditions)))
    .limit(3);
  if (rows.length === 0) return null;
  if (rows.length > 1) return 'ambiguous';
  return rows[0] ?? null;
}
