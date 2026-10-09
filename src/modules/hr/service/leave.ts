import { and, desc, eq, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { canTransitionLeave, countLeaveDays, isIsoDate, type LeaveState } from '../logic';
import { employees, leaveRequests, leaveTypes, type LeaveRequest } from '../schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const leaveInput = z.object({
  employeeId: z.string().regex(UUID_RE),
  typeId: z.string().regex(UUID_RE),
  fromDate: z.string(),
  toDate: z.string(),
  reason: z.preprocess((v) => (typeof v === 'string' ? v.trim() || undefined : v), z.string().max(500).optional()),
});
export type LeaveInput = z.infer<typeof leaveInput>;

export const leaveTypeInput = z.object({ name: z.string().trim().min(1).max(100) });

export interface LeaveRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeUserId: string | null;
  typeId: string;
  typeName: string;
  fromDate: string;
  toDate: string;
  days: string;
  state: LeaveState;
  reason: string | null;
}

async function loadLeave(ctx: Ctx, id: string): Promise<(LeaveRequest & { employeeUserId: string | null }) | null> {
  const [row] = await ctx.tx
    .select({ r: leaveRequests, userId: employees.userId })
    .from(leaveRequests)
    .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
    .where(and(eq(leaveRequests.id, id), eq(leaveRequests.companyId, ctx.companyId)))
    .limit(1);
  return row ? { ...row.r, employeeUserId: row.userId } : null;
}

/** Creates a draft leave request. Days are computed here, never taken from the client. */
export async function createLeaveRequest(ctx: Ctx, input: LeaveInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'hr.leave.write');
  if (!perm.ok) return perm;
  if (!isIsoDate(input.fromDate) || !isIsoDate(input.toDate)) return err('VALIDATION', 'Invalid date', { field: 'fromDate' });
  const days = countLeaveDays(input.fromDate, input.toDate);
  if (days === null) return err('VALIDATION', 'End date must be on or after start date', { field: 'toDate' });

  const [employee] = await ctx.tx
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, input.employeeId), eq(employees.companyId, ctx.companyId)))
    .limit(1);
  if (!employee) return err('VALIDATION', 'Unknown employee', { field: 'employeeId' });

  const [type] = await ctx.tx
    .select({ id: leaveTypes.id })
    .from(leaveTypes)
    .where(and(eq(leaveTypes.id, input.typeId), eq(leaveTypes.companyId, ctx.companyId), eq(leaveTypes.active, true)))
    .limit(1);
  if (!type) return err('VALIDATION', 'Unknown leave type', { field: 'typeId' });

  const [row] = await ctx.tx
    .insert(leaveRequests)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      employeeId: input.employeeId,
      typeId: input.typeId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      days,
      reason: input.reason ?? null,
      state: 'draft',
    })
    .returning({ id: leaveRequests.id });
  if (!row) return err('INTERNAL', 'Insert failed');
  await audit(ctx, { entity: 'hr.leave_request', recordId: row.id, action: 'create', after: { days, state: 'draft' } });
  return ok({ id: row.id });
}

async function moveLeave(ctx: Ctx, id: string, to: LeaveState, action: string): Promise<Result<void>> {
  if (!UUID_RE.test(id)) return err('NOT_FOUND', 'Leave request not found');
  const row = await loadLeave(ctx, id);
  if (!row) return err('NOT_FOUND', 'Leave request not found');
  if (!canTransitionLeave(row.state as LeaveState, to)) {
    return err('STATE', `Cannot ${action} a ${row.state} request`, { state: row.state });
  }
  const now = new Date();
  await ctx.tx
    .update(leaveRequests)
    .set({
      state: to,
      updatedAt: now,
      ...(to === 'approved' || to === 'refused' ? { decidedBy: ctx.userId, decidedAt: now } : {}),
    })
    .where(eq(leaveRequests.id, id));
  await audit(ctx, { entity: 'hr.leave_request', recordId: id, action, before: { state: row.state }, after: { state: to } });
  return ok(undefined);
}

/** Employee sends a draft for approval. Only the requester's own draft may be submitted. */
export async function submitLeave(ctx: Ctx, id: string): Promise<Result<void>> {
  const perm = requirePerm(ctx, 'hr.leave.write');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(id)) return err('NOT_FOUND', 'Leave request not found');
  const row = await loadLeave(ctx, id);
  if (!row) return err('NOT_FOUND', 'Leave request not found');
  if (row.employeeUserId !== ctx.userId && !ctx.perms.has('*')) {
    return err('FORBIDDEN', 'Only the requester can submit this request');
  }
  return moveLeave(ctx, id, 'submitted', 'submit');
}

/** Approve or refuse. Needs hr.leave.approve. Nobody approves their own request. */
export async function decideLeave(ctx: Ctx, id: string, decision: 'approved' | 'refused'): Promise<Result<void>> {
  const perm = requirePerm(ctx, 'hr.leave.approve');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(id)) return err('NOT_FOUND', 'Leave request not found');
  const row = await loadLeave(ctx, id);
  if (!row) return err('NOT_FOUND', 'Leave request not found');
  if (row.employeeUserId === ctx.userId) return err('FORBIDDEN', 'You cannot decide your own leave request');
  return moveLeave(ctx, id, decision, decision === 'approved' ? 'approve' : 'refuse');
}

export async function listLeaveRequests(ctx: Ctx, filter: { state?: string } = {}): Promise<Result<LeaveRow[]>> {
  const perm = requirePerm(ctx, 'hr.leave.read');
  if (!perm.ok) return perm;
  const conditions: SQL[] = [eq(leaveRequests.companyId, ctx.companyId)];
  if (filter.state && ['draft', 'submitted', 'approved', 'refused'].includes(filter.state)) {
    conditions.push(eq(leaveRequests.state, filter.state));
  }
  const rows = await ctx.tx
    .select({
      r: leaveRequests,
      firstName: employees.firstName,
      lastName: employees.lastName,
      userId: employees.userId,
      typeName: leaveTypes.name,
    })
    .from(leaveRequests)
    .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
    .innerJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.typeId))
    .where(and(...conditions))
    .orderBy(desc(leaveRequests.fromDate), desc(leaveRequests.id))
    .limit(200);
  return ok(
    rows.map((x) => ({
      id: x.r.id,
      employeeId: x.r.employeeId,
      employeeName: `${x.firstName} ${x.lastName}`,
      employeeUserId: x.userId,
      typeId: x.r.typeId,
      typeName: x.typeName,
      fromDate: x.r.fromDate,
      toDate: x.r.toDate,
      days: x.r.days,
      state: x.r.state as LeaveState,
      reason: x.r.reason,
    })),
  );
}

export async function listLeaveTypes(ctx: Ctx): Promise<Result<{ id: string; name: string }[]>> {
  const perm = requirePerm(ctx, 'hr.leave.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({ id: leaveTypes.id, name: leaveTypes.name })
    .from(leaveTypes)
    .where(and(eq(leaveTypes.companyId, ctx.companyId), eq(leaveTypes.active, true)))
    .orderBy(leaveTypes.name)
    .limit(100);
  return ok(rows);
}

export async function createLeaveType(ctx: Ctx, input: { name: string }): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'hr.leave.write');
  if (!perm.ok) return perm;
  const [row] = await ctx.tx
    .insert(leaveTypes)
    .values({ companyId: ctx.companyId, createdBy: ctx.userId, name: input.name })
    .returning({ id: leaveTypes.id });
  if (!row) return err('INTERNAL', 'Insert failed');
  await audit(ctx, { entity: 'hr.leave_type', recordId: row.id, action: 'create', after: { name: input.name } });
  return ok({ id: row.id });
}

