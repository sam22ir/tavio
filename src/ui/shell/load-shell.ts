import { redirect } from 'next/navigation';
import type { TenantArgs } from '@/core/db/tenant';
import type { Locale } from '@/core/ctx';
import { getSession } from '@/core/auth/session';
import { modules } from '@/core/modules/registry.generated';
import { can } from '@/core/perms';
import { getActiveCompanyId } from '@/core/tenancy/active';
import { enabledModules, listMyCompanies, loadTenantArgs } from '@/core/tenancy/service';

export interface ShellCompany {
  id: string;
  name: string;
}

export interface ShellNavItem {
  href: string;
  label: string;
}

export interface ShellData {
  email: string;
  companies: ShellCompany[];
  active: ShellCompany;
  tenant: TenantArgs;
  moduleItems: ShellNavItem[];
}

/**
 * Resolves session, companies, active company, tenant args and module menus for the (app) layout and pages.
 * Redirects to login without a session, and to onboarding without companies.
 */
export async function loadShell(locale: Locale): Promise<ShellData> {
  const user = await getSession();
  if (!user) redirect(`/${locale}/login`);

  const memberships = await listMyCompanies(user.userId);
  if (memberships.length === 0) redirect(`/${locale}/onboarding`);

  const stored = await getActiveCompanyId();
  const active = memberships.find((c) => c.id === stored) ?? memberships[0];
  if (!active) redirect(`/${locale}/onboarding`);

  const tenantResult = await loadTenantArgs(user.userId, active.id, locale);
  if (!tenantResult.ok) throw new Error(tenantResult.error.message);
  const tenant = tenantResult.value;

  const enabled = new Set(await enabledModules(active.id));
  const moduleItems = modules
    .filter((m) => enabled.has(m.id))
    .flatMap((m) => m.menus.map((menu) => ({ menu, order: menu.order ?? 0 })))
    .filter(({ menu }) => !menu.perm || can(tenant.perms, menu.perm))
    .sort((a, b) => a.order - b.order)
    .map(({ menu }) => ({ href: `/${locale}${menu.href}`, label: menu.label }));

  return {
    email: user.email,
    companies: memberships.map((c) => ({ id: c.id, name: c.name })),
    active: { id: active.id, name: active.name },
    tenant,
    moduleItems,
  };
}
