import { and, asc, count, eq, ilike, or, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import type { ListQuery, ListResult, Row } from '@/core/entities/types';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { normalizePhone } from '@/modules/contacts/service/partners';
import { departments, employees, type Department, type Employee } from '../schema';
import { isIsoDate } from '../logic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PAGE_SIZE = 100;

// Empty form strings become undefined; the rest is validated below.
const optionalText = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() || undefined : v),
  z.string().max(300).optional(),
);
const optionalUuid = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() || undefined : v),
  z.string().regex(UUID_RE).optional(),
);
const flag = z.preprocess((v) => v === true || v === 'on' || v === 'true', z.boolean());

export const employeeInput = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  jobTitle: optionalText,
  departmentId: optionalUuid,
  managerId: optionalUuid,
  hireDate: optionalText,
  phone: optionalText,
  email: z.preprocess((v) => (typeof v === 'string' ? v.trim() || undefined : v), z.email().optional()),
  nin: optionalText,
  active: flag,
});
export type EmployeeInput = z.infer<typeof employeeInput>;

export const departmentInput = z.object({ name: z.string().trim().min(1).max(100) });

export interface EmployeeRow extends Row {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  departmentId: string | null;
  departmentName: string | null;
  managerId: string | null;
  hireDate: string | null;
  phone: string | null;
  email: string | null;
  nin: string | null;
  active: boolean;
  userId: string | null;
}

function toRow(e: Employee, departmentName: string | null): EmployeeRow {
  return {
    id: e.id,
    displayName: `${e.firstName} ${e.lastName}`,
    firstName: e.firstName,
    lastName: e.lastName,
    jobTitle: e.jobTitle,
    departmentId: e.departmentId,
    departmentName,
    managerId: e.managerId,
    hireDate: e.hireDate,
    phone: e.phone,
    email: e.email,
    nin: e.nin,
    active: e.active,
    userId: e.userId,
  };
}

/** Validates the business rules of an employee and returns the stored values. */
export function normalizeEmployee(input: EmployeeInput): Result<Omit<EmployeeInput, 'phone' | 'hireDate'> & { phone: string | null; hireDate: string | null }> {
  let phone: string | null = null;
  if (input.phone !== undefined) {
    phone = normalizePhone(input.phone);
    if (phone === null) return err('VALIDATION', 'Invalid phone number', { field: 'phone' });
  }
  if (input.hireDate !== undefined && !isIsoDate(input.hireDate)) {
    return err('VALIDATION', 'Invalid hire date', { field: 'hireDate' });
  }
  return ok({ ...input, phone, hireDate: input.hireDate ?? null });
}

async function loadEmployee(ctx: Ctx, id: string): Promise<Employee | null> {
  const [row] = await ctx.tx
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.companyId, ctx.companyId)))
    .limit(1);
  return row ?? null;
}

async function checkDepartmentAndManager(
  ctx: Ctx,
  departmentId: string | undefined,
  managerId: string | undefined,
  selfId?: string,
): Promise<Result<void>> {
  if (departmentId) {
    const [d] = await ctx.tx
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.id, departmentId), eq(departments.companyId, ctx.companyId)))
      .limit(1);
    if (!d) return err('VALIDATION', 'Unknown department', { field: 'departmentId' });
  }
  if (managerId) {
    if (managerId === selfId) return err('VALIDATION', 'An employee cannot manage themselves', { field: 'managerId' });
    const m = await loadEmployee(ctx, managerId);
    if (!m) return err('VALIDATION', 'Unknown manager', { field: 'managerId' });
  }
  return ok(undefined);
}

export async function createEmployee(ctx: Ctx, input: EmployeeInput): Promise<Result<EmployeeRow>> {
  const perm = requirePerm(ctx, 'hr.employee.write');
  if (!perm.ok) return perm;
  const values = normalizeEmployee(input);
  if (!values.ok) return values;
  const check = await checkDepartmentAndManager(ctx, values.value.departmentId, values.value.managerId);
  if (!check.ok) return check;

  const [row] = await ctx.tx
    .insert(employees)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      firstName: values.value.firstName,
      lastName: values.value.lastName,
      jobTitle: values.value.jobTitle ?? null,
      departmentId: values.value.departmentId ?? null,
      managerId: values.value.managerId ?? null,
      hireDate: values.value.hireDate,
      phone: values.value.phone,
      email: values.value.email ?? null,
      nin: values.value.nin ?? null,
      active: values.value.active,
    })
    .returning();
  if (!row) return err('INTERNAL', 'Insert failed');
  await audit(ctx, { entity: 'hr.employee', recordId: row.id, action: 'create', after: { firstName: row.firstName, lastName: row.lastName } });
  return ok(toRow(row, null));
}

export async function updateEmployee(ctx: Ctx, id: string, input: EmployeeInput): Promise<Result<EmployeeRow>> {
  const perm = requirePerm(ctx, 'hr.employee.write');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(id)) return err('NOT_FOUND', 'Employee not found');
  const before = await loadEmployee(ctx, id);
  if (!before) return err('NOT_FOUND', 'Employee not found');
  const values = normalizeEmployee(input);
  if (!values.ok) return values;
  const check = await checkDepartmentAndManager(ctx, values.value.departmentId, values.value.managerId, id);
  if (!check.ok) return check;

  const [row] = await ctx.tx
    .update(employees)
    .set({
      firstName: values.value.firstName,
      lastName: values.value.lastName,
      jobTitle: values.value.jobTitle ?? null,
      departmentId: values.value.departmentId ?? null,
      managerId: values.value.managerId ?? null,
      hireDate: values.value.hireDate,
      phone: values.value.phone,
      email: values.value.email ?? null,
      nin: values.value.nin ?? null,
      active: values.value.active,
      updatedAt: new Date(),
    })
    .where(eq(employees.id, id))
    .returning();
  if (!row) return err('NOT_FOUND', 'Employee not found');
  await audit(ctx, { entity: 'hr.employee', recordId: id, action: 'update', before: { active: before.active }, after: { active: row.active } });
  return ok(toRow(row, null));
}

/** Archives instead of deleting, so leave and attendance history stays intact. */
export async function setEmployeeActive(ctx: Ctx, id: string, active: boolean): Promise<Result<void>> {
  const perm = requirePerm(ctx, 'hr.employee.write');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(id)) return err('NOT_FOUND', 'Employee not found');
  const before = await loadEmployee(ctx, id);
  if (!before) return err('NOT_FOUND', 'Employee not found');
  await ctx.tx.update(employees).set({ active, updatedAt: new Date() }).where(eq(employees.id, id));
  await audit(ctx, { entity: 'hr.employee', recordId: id, action: active ? 'activate' : 'archive', before: { active: before.active }, after: { active } });
  return ok(undefined);
}

export async function getEmployee(ctx: Ctx, id: string): Promise<Result<EmployeeRow>> {
  const perm = requirePerm(ctx, 'hr.employee.read');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(id)) return err('NOT_FOUND', 'Employee not found');
  const [row] = await ctx.tx
    .select({ e: employees, dept: departments.name })
    .from(employees)
    .leftJoin(departments, eq(departments.id, employees.departmentId))
    .where(and(eq(employees.id, id), eq(employees.companyId, ctx.companyId)))
    .limit(1);
  if (!row) return err('NOT_FOUND', 'Employee not found');
  return ok(toRow(row.e, row.dept ?? null));
}

/** The employee record linked to the signed-in user, if any. */
export async function getEmployeeForUser(ctx: Ctx): Promise<Result<EmployeeRow>> {
  const [row] = await ctx.tx
    .select({ e: employees, dept: departments.name })
    .from(employees)
    .leftJoin(departments, eq(departments.id, employees.departmentId))
    .where(and(eq(employees.userId, ctx.userId), eq(employees.companyId, ctx.companyId)))
    .limit(1);
  if (!row) return err('NOT_FOUND', 'No employee record is linked to your account');
  return ok(toRow(row.e, row.dept ?? null));
}

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listEmployees(ctx: Ctx, query: ListQuery): Promise<Result<ListResult<EmployeeRow>>> {
  const perm = requirePerm(ctx, 'hr.employee.read');
  if (!perm.ok) return perm;

  const conditions: SQL[] = [eq(employees.companyId, ctx.companyId)];
  const term = query.q?.trim();
  if (term) {
    const pattern = `%${escapeLike(term)}%`;
    const search = or(ilike(employees.firstName, pattern), ilike(employees.lastName, pattern), ilike(employees.jobTitle, pattern));
    if (search) conditions.push(search);
  }
  if (query.filters.active === 'true' || query.filters.active === 'false') {
    conditions.push(eq(employees.active, query.filters.active === 'true'));
  }
  const where = and(...conditions);
  const pageSize = Math.min(Math.max(1, query.pageSize), MAX_PAGE_SIZE);
  const page = Math.max(1, query.page);

  const [totalRow] = await ctx.tx.select({ n: count() }).from(employees).where(where);
  const rows = await ctx.tx
    .select({ e: employees, dept: departments.name })
    .from(employees)
    .leftJoin(departments, eq(departments.id, employees.departmentId))
    .where(where)
    .orderBy(asc(employees.lastName), asc(employees.firstName), asc(employees.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return ok({ rows: rows.map((r) => toRow(r.e, r.dept ?? null)), total: Number(totalRow?.n ?? 0), page, pageSize });
}

/** Active employees for selects (managers, leave and attendance). */
export async function employeeOptions(ctx: Ctx): Promise<Result<{ value: string; label: string }[]>> {
  const perm = requirePerm(ctx, 'hr.employee.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({ id: employees.id, firstName: employees.firstName, lastName: employees.lastName })
    .from(employees)
    .where(and(eq(employees.companyId, ctx.companyId), eq(employees.active, true)))
    .orderBy(asc(employees.lastName), asc(employees.firstName))
    .limit(500);
  return ok(rows.map((r) => ({ value: r.id, label: `${r.firstName} ${r.lastName}` })));
}

export async function listDepartments(ctx: Ctx): Promise<Result<Department[]>> {
  const perm = requirePerm(ctx, 'hr.department.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select()
    .from(departments)
    .where(eq(departments.companyId, ctx.companyId))
    .orderBy(asc(departments.name))
    .limit(500);
  return ok(rows);
}

export async function createDepartment(ctx: Ctx, input: { name: string }): Promise<Result<Department>> {
  const perm = requirePerm(ctx, 'hr.department.write');
  if (!perm.ok) return perm;
  const [row] = await ctx.tx
    .insert(departments)
    .values({ companyId: ctx.companyId, createdBy: ctx.userId, name: input.name })
    .returning();
  if (!row) return err('INTERNAL', 'Insert failed');
  await audit(ctx, { entity: 'hr.department', recordId: row.id, action: 'create', after: { name: row.name } });
  return ok(row);
}
