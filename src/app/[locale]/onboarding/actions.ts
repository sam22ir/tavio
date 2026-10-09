'use server';

import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/core/auth/session';
import { withTenant, type TenantArgs } from '@/core/db/tenant';
import { companies, companyModules } from '@/core/db/schema/tenancy';
import type { Locale } from '@/core/ctx';
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES, uploadFile } from '@/core/files/service';
import { setActiveCompanyId } from '@/core/tenancy/active';
import { INVITABLE_ROLE_KEYS, createInvitation, type InvitableRoleKey } from '@/core/tenancy/invitations';
import { tenantForUser } from '@/core/tenancy/tenant-access';
import { createCompany, findRecentOwnedCompany, loadTenantArgs, MODULE_VERSION } from '@/core/tenancy/service';
import { BUSINESS_TYPE_MODULES, isBusinessType } from '@/core/tenancy/business-types';
import { isWilayaCode } from '@/core/tenancy/wilayas';

export type OnboardingResult<T = void> = { ok: true; value: T } | { ok: false; key: string };

const fail = (key: string): { ok: false; key: string } => ({ ok: false, key: `errors.${key}` });

async function currentLocale(): Promise<Locale> {
  const l = await getLocale();
  return l === 'ar' || l === 'en' ? l : 'fr';
}

function text(formData: FormData, name: string, max: number): string {
  const raw = formData.get(name);
  return typeof raw === 'string' ? raw.trim().slice(0, max) : '';
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

/** Stores the logo and points the company at it. Returns false when storage is unavailable; never throws. */
async function attachLogo(tenant: TenantArgs, file: File): Promise<boolean> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return await withTenant(tenant, async (ctx) => {
      const up = await uploadFile(ctx, {
        entity: 'companies',
        recordId: tenant.companyId,
        fileName: file.name || 'logo',
        contentType: file.type,
        bytes,
        kind: 'company_logo',
      });
      if (!up.ok) return false;
      await ctx.tx.update(companies).set({ logoFileId: up.value.id }).where(eq(companies.id, tenant.companyId));
      return true;
    });
  } catch {
    return false;
  }
}

/** Step 1: creates the company. A repeat with the same name within 2 minutes returns the existing company. */
export async function createCompanyStep(
  formData: FormData,
): Promise<OnboardingResult<{ companyId: string; logoSaved: boolean }>> {
  const user = await requireUser();
  if (!user.ok) return fail('session');
  const locale = await currentLocale();

  const legalName = text(formData, 'legalName', 200);
  if (legalName.length < 2) return fail('validation');
  const phone = text(formData, 'phone', 30) || undefined;
  const wilayaCode = text(formData, 'wilayaCode', 2) || undefined;
  if (wilayaCode && !isWilayaCode(wilayaCode)) return fail('validation');

  const logoRaw = formData.get('logo');
  const logo = logoRaw instanceof File && logoRaw.size > 0 ? logoRaw : null;
  if (logo && (logo.size > MAX_FILE_BYTES || !(ALLOWED_MIME_TYPES as readonly string[]).includes(logo.type))) {
    return fail('logo');
  }

  const existing = await findRecentOwnedCompany(user.value.userId, legalName);
  if (existing) {
    await setActiveCompanyId(existing.id);
    return { ok: true, value: { companyId: existing.id, logoSaved: false } };
  }

  const created = await createCompany(user.value.userId, { legalName, phone, wilayaCode });
  if (!created.ok) return fail('generic');
  const companyId = created.value.companyId;
  await setActiveCompanyId(companyId);

  let logoSaved = false;
  if (logo) {
    const tenant = await loadTenantArgs(user.value.userId, companyId, locale);
    if (tenant.ok) logoSaved = await attachLogo(tenant.value, logo);
  }
  return { ok: true, value: { companyId, logoSaved } };
}

/** Step 2: stores the business type and enables its modules (missing rows only). */
export async function saveBusinessTypeStep(input: {
  companyId: string;
  businessType: string;
}): Promise<OnboardingResult> {
  if (!isBusinessType(input.businessType)) return fail('validation');
  const tenant = await tenantForUser({ locale: await currentLocale(), companyId: input.companyId, needManage: true });
  if (!tenant.ok) return fail('forbidden');
  const type = input.businessType;
  const modules = BUSINESS_TYPE_MODULES[type];
  try {
    await withTenant(tenant.value, async (ctx) => {
      await ctx.tx
        .update(companies)
        .set({ businessType: type, updatedAt: new Date() })
        .where(eq(companies.id, input.companyId));
      if (modules.length > 0) {
        const now = new Date();
        await ctx.tx
          .insert(companyModules)
          .values(
            modules.map((moduleId) => ({
              companyId: input.companyId,
              moduleId,
              version: MODULE_VERSION,
              enabled: true,
              enabledAt: now,
              createdBy: tenant.value.userId,
            })),
          )
          .onConflictDoNothing();
      }
    });
  } catch {
    return fail('generic');
  }
  return { ok: true, value: undefined };
}

export interface InviteRowInput {
  email: string;
  roleKey: string;
}

export interface InviteRowResult {
  email: string;
  status: 'sent' | 'link' | 'failed';
  /** Only when outgoing email is not configured: the link to share by hand. */
  url?: string;
}

/** Step 3: invites team members with the existing invitation service. Blank rows are ignored. */
export async function inviteTeamStep(input: {
  companyId: string;
  rows: InviteRowInput[];
}): Promise<OnboardingResult<InviteRowResult[]>> {
  const locale = await currentLocale();
  const tenant = await tenantForUser({ locale, companyId: input.companyId, needManage: true });
  if (!tenant.ok) return fail('forbidden');
  const origin = await requestOrigin();
  const allowed = new Set<string>(INVITABLE_ROLE_KEYS);

  const results: InviteRowResult[] = [];
  for (const row of input.rows.slice(0, 10)) {
    const email = row.email.trim();
    if (!email) continue;
    if (!allowed.has(row.roleKey)) {
      results.push({ email, status: 'failed' });
      continue;
    }
    const created = await createInvitation(tenant.value.userId, input.companyId, {
      email,
      roleKey: row.roleKey as InvitableRoleKey,
      locale,
      baseUrl: origin,
    });
    if (!created.ok) results.push({ email, status: 'failed' });
    else if (created.value.emailSent) results.push({ email, status: 'sent' });
    else results.push({ email, status: 'link', url: created.value.url });
  }
  return { ok: true, value: results };
}
