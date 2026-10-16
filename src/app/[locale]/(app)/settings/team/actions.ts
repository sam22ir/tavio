'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import type { Locale } from '@/core/ctx';
import { requireUser } from '@/core/auth/session';
import { getActiveCompanyId, setActiveCompanyId } from '@/core/tenancy/active';
import { listMyCompanies } from '@/core/tenancy/service';
import { INVITABLE_ROLE_KEYS, acceptInvitation, createInvitation, resendInvitation, revokeInvitation } from '@/core/tenancy/invitations';
import { changeRole, removeMember, MEMBER_ROLE_KEYS } from '@/core/tenancy/members';
import type { AppError } from '@/core/result';

export type TeamActionResult<T = void> = { ok: true; value: T } | { ok: false; key: string };

/** i18n key (namespace team) for an error: the service reason when given, else the code. */
function errorKey(error: AppError): string {
  const reason = error.details?.reason;
  return typeof reason === 'string' ? `errors.${reason}` : `errors.${error.code.toLowerCase()}`;
}

async function currentCompany(): Promise<{ userId: string; companyId: string } | null> {
  const user = await requireUser();
  if (!user.ok) return null;
  const companies = await listMyCompanies(user.value.userId);
  const stored = await getActiveCompanyId();
  const company = companies.find((c) => c.id === stored) ?? companies[0];
  return company ? { userId: user.value.userId, companyId: company.id } : null;
}

function refresh(): void {
  try {
    revalidatePath('/', 'layout');
  } catch {
    // Outside a server action context. Nothing to invalidate.
  }
}

/** Public origin for invitation links: BETTER_AUTH_URL, else the request host. */
async function requestOrigin(): Promise<string> {
  const configured = process.env.BETTER_AUTH_URL?.trim();
  if (configured) return configured;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  return host ? `${proto}://${host}` : '';
}

const inviteSchema = z.object({
  email: z.email().max(254),
  roleKey: z.enum(INVITABLE_ROLE_KEYS),
});

export async function inviteMemberAction(
  input: z.input<typeof inviteSchema>,
): Promise<TeamActionResult<{ url: string; emailSent: boolean }>> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, key: 'errors.validation' };
  const scope = await currentCompany();
  if (!scope) return { ok: false, key: 'errors.unauthenticated' };
  const locale = (await getLocale()) as Locale;
  const result = await createInvitation(scope.userId, scope.companyId, {
    ...parsed.data,
    locale,
    baseUrl: await requestOrigin(),
  });
  if (!result.ok) return { ok: false, key: errorKey(result.error) };
  refresh();
  return { ok: true, value: { url: result.value.url, emailSent: result.value.emailSent } };
}

export async function resendInvitationAction(
  invitationId: string,
): Promise<TeamActionResult<{ url: string; emailSent: boolean }>> {
  const scope = await currentCompany();
  if (!scope) return { ok: false, key: 'errors.unauthenticated' };
  const locale = (await getLocale()) as Locale;
  const result = await resendInvitation(scope.userId, scope.companyId, invitationId, {
    locale,
    baseUrl: await requestOrigin(),
  });
  if (!result.ok) return { ok: false, key: errorKey(result.error) };
  refresh();
  return { ok: true, value: { url: result.value.url, emailSent: result.value.emailSent } };
}

export async function revokeInvitationAction(invitationId: string): Promise<TeamActionResult> {
  const scope = await currentCompany();
  if (!scope) return { ok: false, key: 'errors.unauthenticated' };
  const result = await revokeInvitation(scope.userId, scope.companyId, invitationId);
  if (!result.ok) return { ok: false, key: errorKey(result.error) };
  refresh();
  return { ok: true, value: undefined };
}

export async function changeRoleAction(membershipId: string, roleKey: string): Promise<TeamActionResult> {
  if (!(MEMBER_ROLE_KEYS as readonly string[]).includes(roleKey)) return { ok: false, key: 'errors.validation' };
  const scope = await currentCompany();
  if (!scope) return { ok: false, key: 'errors.unauthenticated' };
  const result = await changeRole(scope.userId, scope.companyId, membershipId, roleKey);
  if (!result.ok) return { ok: false, key: errorKey(result.error) };
  refresh();
  return { ok: true, value: undefined };
}

export async function removeMemberAction(membershipId: string): Promise<TeamActionResult> {
  const scope = await currentCompany();
  if (!scope) return { ok: false, key: 'errors.unauthenticated' };
  const result = await removeMember(scope.userId, scope.companyId, membershipId);
  if (!result.ok) return { ok: false, key: errorKey(result.error) };
  refresh();
  return { ok: true, value: undefined };
}

/** Accepts an invitation for the signed-in user and makes that company active. */
export async function acceptInvitationAction(token: string): Promise<TeamActionResult<{ companyId: string }>> {
  const user = await requireUser();
  if (!user.ok) return { ok: false, key: 'errors.unauthenticated' };
  const result = await acceptInvitation(user.value.userId, token);
  if (!result.ok) return { ok: false, key: errorKey(result.error) };
  await setActiveCompanyId(result.value.companyId);
  refresh();
  return { ok: true, value: { companyId: result.value.companyId } };
}
