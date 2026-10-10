import { and, eq } from 'drizzle-orm';
import { registerEntityAccess } from '@/modules/chatter/service';
import { leads } from '../schema';
import { leadScope } from './teams';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Chatter on a crm.lead follows the lead visibility scope.
registerEntityAccess('crm.lead', async (ctx, recordId) => {
  if (!UUID_RE.test(recordId)) return false;
  const scope = await leadScope(ctx);
  const [row] = await ctx.tx
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.companyId, ctx.companyId), eq(leads.id, recordId), scope))
    .limit(1);
  return Boolean(row);
});
