import { and, desc, eq, gte, isNull, lt } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { attendances, employees, type Attendance } from '../schema';
import { summarizeAttendance, type AttendanceSummaryRow } from '../logic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

async function assertActiveEmployee(ctx: Ctx, employeeId: string): Promise<Result<void>> {
  if (!UUID_RE.test(employeeId)) return err('NOT_FOUND', 'Employee not found');
  const [row] = await ctx.tx
    .select({ id: employees.id, active: employees.active })
    .from(employees)
    .where(and(eq(employees.id, employeeId), eq(employees.companyId, ctx.companyId)))
    .limit(1);
  if (!row) return err('NOT_FOUND', 'Employee not found');
  if (!row.active) return err('STATE', 'Employee is archived');
  return ok(undefined);
}

/** Opens an attendance span. Only one open span per employee is allowed. */
export async function checkIn(ctx: Ctx, employeeId: string, at: Date = new Date()): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'hr.attendance.write');
  if (!perm.ok) return perm;
  const emp = await assertActiveEmployee(ctx, employeeId);
  if (!emp.ok) return emp;

  const [open] = await ctx.tx
    .select({ id: attendances.id })
    .from(attendances)
    .where(and(eq(attendances.companyId, ctx.companyId), eq(attendances.employeeId, employeeId), isNull(attendances.checkOut)))
    .limit(1);
  if (open) return err('CONFLICT', 'Already checked in');

  const [row] = await ctx.tx
    .insert(attendances)
    .values({ companyId: ctx.companyId, createdBy: ctx.userId, employeeId, checkIn: at })
    .returning({ id: attendances.id });
  if (!row) return err('INTERNAL', 'Insert failed');
  await audit(ctx, { entity: 'hr.attendance', recordId: row.id, action: 'check_in', after: { employeeId } });
  return ok({ id: row.id });
}

/** Closes the employee's open span. Fails when there is none. */
export async function checkOut(ctx: Ctx, employeeId: string, at: Date = new Date()): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'hr.attendance.write');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(employeeId)) return err('NOT_FOUND', 'Employee not found');

  const [open] = await ctx.tx
    .select()
    .from(attendances)
    .where(and(eq(attendances.companyId, ctx.companyId), eq(attendances.employeeId, employeeId), isNull(attendances.checkOut)))
    .limit(1);
  if (!open) return err('STATE', 'Not checked in');
  if (at.getTime() < open.checkIn.getTime()) return err('VALIDATION', 'Check-out is before check-in', { field: 'checkOut' });

  await ctx.tx.update(attendances).set({ checkOut: at, updatedAt: new Date() }).where(eq(attendances.id, open.id));
  await audit(ctx, { entity: 'hr.attendance', recordId: open.id, action: 'check_out', before: { checkOut: null }, after: { checkOut: at.toISOString() } });
  return ok({ id: open.id });
}

/** Whether the employee is currently checked in, and since when. */
export async function openSpan(ctx: Ctx, employeeId: string): Promise<Result<Attendance | null>> {
  const perm = requirePerm(ctx, 'hr.attendance.read');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(employeeId)) return err('NOT_FOUND', 'Employee not found');
  const [row] = await ctx.tx
    .select()
    .from(attendances)
    .where(and(eq(attendances.companyId, ctx.companyId), eq(attendances.employeeId, employeeId), isNull(attendances.checkOut)))
    .limit(1);
  return ok(row ?? null);
}

/** Recent spans, newest first, optionally for one employee. */
export async function listAttendance(ctx: Ctx, employeeId?: string): Promise<Result<(Attendance & { employeeName: string })[]>> {
  const perm = requirePerm(ctx, 'hr.attendance.read');
  if (!perm.ok) return perm;
  const conditions = [eq(attendances.companyId, ctx.companyId)];
  if (employeeId) {
    if (!UUID_RE.test(employeeId)) return err('NOT_FOUND', 'Employee not found');
    conditions.push(eq(attendances.employeeId, employeeId));
  }
  const rows = await ctx.tx
    .select({ a: attendances, firstName: employees.firstName, lastName: employees.lastName })
    .from(attendances)
    .innerJoin(employees, eq(employees.id, attendances.employeeId))
    .where(and(...conditions))
    .orderBy(desc(attendances.checkIn))
    .limit(200);
  return ok(rows.map((r) => ({ ...r.a, employeeName: `${r.firstName} ${r.lastName}` })));
}

/** Per-employee totals for a month (YYYY-MM). Filters in SQL, then aggregates with logic.ts. */
export async function monthlyAttendanceSummary(
  ctx: Ctx,
  month: string,
): Promise<Result<AttendanceSummaryRow[]>> {
  const perm = requirePerm(ctx, 'hr.attendance.read');
  if (!perm.ok) return perm;
  if (!MONTH_RE.test(month)) return err('VALIDATION', 'Month must be YYYY-MM', { field: 'month' });

  const start = new Date(`${month}-01T00:00:00Z`);
  const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const rows = await ctx.tx
    .select({ employeeId: attendances.employeeId, checkIn: attendances.checkIn, checkOut: attendances.checkOut })
    .from(attendances)
    .where(
      and(
        eq(attendances.companyId, ctx.companyId),
        gte(attendances.checkIn, start),
        lt(attendances.checkIn, next),
      ),
    )
    .limit(10000);
  return ok(summarizeAttendance(rows, month));
}
