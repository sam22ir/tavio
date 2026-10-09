import '@/modules/event-handlers';
import { getLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { Ctx, Locale } from '@/core/ctx';
import { requireUser } from '@/core/auth/session';
import { getActiveCompanyId } from '@/core/tenancy/active';
import { listMyCompanies, loadTenantArgs } from '@/core/tenancy/service';
import { withTenant } from '@/core/db/tenant';

/**
 * Builds a tenant ctx for a server component or page. Resolves the session, the active company
 * (falls back to the first membership when the cookie is missing or invalid) and the tenant,
 * and redirects to login or onboarding when needed.
 */
export async function withPageCtx<T>(fn: (ctx: Ctx) => Promise<T>): Promise<T> {
  const locale = (await getLocale()) as Locale;

  const user = await requireUser();
  if (!user.ok) redirect(`/${locale}/login`);

  const memberships = await listMyCompanies(user.value.userId);
  if (memberships.length === 0) redirect(`/${locale}/onboarding`);

  const stored = await getActiveCompanyId();
  const active = memberships.find((c) => c.id === stored) ?? memberships[0]!;

  const args = await loadTenantArgs(user.value.userId, active.id, locale);
  if (!args.ok) throw new Error(args.error.message);

  return withTenant(args.value, fn);
}
