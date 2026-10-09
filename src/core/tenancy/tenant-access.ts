// Resolves the caller's tenant for server actions. Membership is checked by loadTenantArgs.
import type { TenantArgs } from '@/core/db/tenant';
import type { Locale } from '@/core/ctx';
import { requireUser } from '@/core/auth/session';
import { err, type Result } from '@/core/result';
import { getActiveCompanyId } from './active';
import { listMyCompanies, loadTenantArgs } from './service';

/** The tenant for `companyId`, or the active company when omitted. `needManage` requires the owner or admin wildcard. */
export async function tenantForUser(args: {
  locale: Locale;
  companyId?: string;
  needManage?: boolean;
}): Promise<Result<TenantArgs>> {
  const user = await requireUser();
  if (!user.ok) return err('UNAUTHENTICATED', 'sign in required');
  let companyId = args.companyId;
  if (!companyId) {
    const companies = await listMyCompanies(user.value.userId);
    const stored = await getActiveCompanyId();
    companyId = (companies.find((c) => c.id === stored) ?? companies[0])?.id;
  }
  if (!companyId) return err('NOT_FOUND', 'no company for this user');
  const tenant = await loadTenantArgs(user.value.userId, companyId, args.locale);
  if (!tenant.ok) return tenant;
  if (args.needManage && !tenant.value.perms.has('*')) return err('FORBIDDEN', 'owner or admin required');
  return tenant;
}
