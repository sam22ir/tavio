// Smart buttons. Side-effect file: imported by modules/relation-handlers.
import { and, count, eq } from 'drizzle-orm';
import { relations } from '@/core/relations';
import { leaveRequests } from '@/modules/hr/schema';

relations.register({
  id: 'hr.employee->hr.leave',
  source: 'hr.employee',
  labelKey: 'relations.employee.leaves',
  icon: 'CalendarDays',
  perm: 'hr.leave.read',
  count: async (ctx, id) => {
    const [row] = await ctx.tx
      .select({ value: count() })
      .from(leaveRequests)
      .where(and(eq(leaveRequests.companyId, ctx.companyId), eq(leaveRequests.employeeId, id)));
    return row?.value ?? 0;
  },
  href: (locale, id) => `/${locale}/hr/leave?f_employeeId=${id}`,
});
