import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDevEnv } from '@/core/env/load-dev-env';
import { getDb } from '@/core/db/client';
import { companies, users } from '@/core/db/schema';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import type { Ctx } from '@/core/ctx';
import { attendances, departments, employees, leaveRequests, leaveTypes } from '../schema';
import { checkIn, checkOut } from '../service/attendance';
import { createEmployee, getEmployeeForUser } from '../service/employees';
import { createLeaveRequest, createLeaveType, decideLeave, submitLeave } from '../service/leave';

// Runs only after the integrator migrates the DB: set TAVIO_W5_DB=1 to enable.
loadDevEnv();

const db = getDb();
const userId = randomUUID();
const otherUserId = randomUUID();
const companyId = randomUUID();
const PERMS = new Set(['hr.employee.read', 'hr.employee.write', 'hr.leave.read', 'hr.leave.write', 'hr.leave.approve', 'hr.attendance.read', 'hr.attendance.write']);

const argsFor = (uid: string): TenantArgs => ({ userId: uid, companyId, perms: PERMS, locale: 'en' });
const run = <T>(uid: string, fn: (ctx: Ctx) => Promise<T>) => withTenant(argsFor(uid), fn);

describe.skipIf(!process.env.TAVIO_W5_DB)('hr integration', () => {
  let requesterId = '';
  let typeId = '';

  beforeAll(async () => {
    await db.insert(users).values([
      { id: userId, name: 'HR test', email: `hr-${userId}@test.invalid` },
      { id: otherUserId, name: 'HR approver', email: `hr-${otherUserId}@test.invalid` },
    ]);
    await db.insert(companies).values({ id: companyId, legalName: 'HR Co', displayName: 'HR Co' });

    await run(userId, async (ctx) => {
      await ctx.tx.insert(departments).values({ companyId, name: 'Ops' });
      const req = await createEmployee(ctx, {
        firstName: 'Amel', lastName: 'Bensaid', active: true,
      });
      if (!req.ok) throw new Error(req.error.message);
      requesterId = req.value.id;
      await ctx.tx.update(employees).set({ userId }).where(inArray(employees.id, [requesterId]));
      const type = await createLeaveType(ctx, { name: 'Annual' });
      if (!type.ok) throw new Error(type.error.message);
      typeId = type.value.id;
    });
    await run(otherUserId, async (ctx) => {
      const mgr = await createEmployee(ctx, {
        firstName: 'Yacine', lastName: 'Meziane', active: true,
      });
      if (!mgr.ok) throw new Error(mgr.error.message);
    });
  });

  afterAll(async () => {
    try {
      await db.delete(attendances).where(inArray(attendances.companyId, [companyId]));
      await db.delete(leaveRequests).where(inArray(leaveRequests.companyId, [companyId]));
      await db.delete(leaveTypes).where(inArray(leaveTypes.companyId, [companyId]));
      await db.delete(employees).where(inArray(employees.companyId, [companyId]));
      await db.delete(departments).where(inArray(departments.companyId, [companyId]));
      await db.delete(companies).where(inArray(companies.id, [companyId]));
    } catch {
      // Audit rows reference the company, so cleanup can be refused.
    }
  });

  it('creates a leave request with server-computed days and walks the state machine', async () => {
    const created = await run(userId, (ctx) =>
      createLeaveRequest(ctx, { employeeId: requesterId, typeId, fromDate: '2026-07-01', toDate: '2026-07-03', reason: undefined }),
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.value.id;

    const selfApprove = await run(userId, (ctx) => decideLeave(ctx, id, 'approved'));
    expect(selfApprove.ok).toBe(false);

    const sub = await run(userId, (ctx) => submitLeave(ctx, id));
    expect(sub.ok).toBe(true);

    const approved = await run(otherUserId, (ctx) => decideLeave(ctx, id, 'approved'));
    expect(approved.ok).toBe(true);

    const again = await run(otherUserId, (ctx) => decideLeave(ctx, id, 'refused'));
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('STATE');
  });

  it('allows one open attendance per employee', async () => {
    const first = await run(userId, (ctx) => checkIn(ctx, requesterId, new Date('2026-07-01T08:00:00Z')));
    expect(first.ok).toBe(true);
    const second = await run(userId, (ctx) => checkIn(ctx, requesterId, new Date('2026-07-01T09:00:00Z')));
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('CONFLICT');
    const out = await run(userId, (ctx) => checkOut(ctx, requesterId, new Date('2026-07-01T16:00:00Z')));
    expect(out.ok).toBe(true);
  });

  it('resolves the linked employee for the signed-in user', async () => {
    const me = await run(userId, (ctx) => getEmployeeForUser(ctx));
    expect(me.ok).toBe(true);
    if (me.ok) expect(me.value.id).toBe(requesterId);
  });
});
