'use server';

import { eq } from 'drizzle-orm';
import { getLocale } from 'next-intl/server';
import type { Locale } from '@/core/ctx';
import { audit } from '@/core/audit';
import { companies } from '@/core/db/schema/tenancy';
import { withTenant } from '@/core/db/tenant';
import { uploadFile } from '@/core/files/service';
import { tenantForUser } from '@/core/tenancy/tenant-access';
import { isWilayaCode } from '@/core/tenancy/wilayas';

export type CompanyFormState =
  | { status: 'idle' }
  | { status: 'error'; key: string }
  | { status: 'saved'; warnings: string[] };

/** Fields a company admin may edit. Maps 1:1 to companies columns already in the schema. */
const TEXT_FIELDS = [
  'legalName', 'displayName', 'address', 'wilayaCode', 'phone', 'email',
  'nif', 'nis', 'rc', 'ai', 'rib', 'ccp',
] as const;
type TextField = (typeof TEXT_FIELDS)[number];
const MAX_LEN = 255;

/** Format checks that only warn. Algerian identifiers vary in practice, so they never block a save. */
const WARN_FORMATS: Partial<Record<TextField, { re: RegExp; key: string }>> = {
  nif: { re: /^\d{15}$/, key: 'nifFormat' },
  nis: { re: /^\d{15}$/, key: 'nisFormat' },
  rib: { re: /^\d{20}$/, key: 'ribFormat' },
};

async function currentLocale(): Promise<Locale> {
  const l = await getLocale();
  return l === 'ar' || l === 'en' ? l : 'fr';
}

function readText(formData: FormData, name: TextField): string | null {
  const raw = formData.get(name);
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  return value.length > MAX_LEN ? value.slice(0, MAX_LEN) : value;
}

/** Updates company identity and optional logo. Owner or admin only. Audited in the same transaction. */
export async function updateCompanyIdentity(
  _prev: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const locale = await currentLocale();
  const tenant = await tenantForUser({ locale, needManage: true });
  if (!tenant.ok) return { status: 'error', key: tenant.error.code === 'FORBIDDEN' ? 'errors.forbidden' : 'errors.session' };

  const values: Partial<Record<TextField, string | null>> = {};
  for (const field of TEXT_FIELDS) {
    const v = readText(formData, field);
    if (v !== null) values[field] = v === '' ? null : v;
  }
  const legalName = values.legalName;
  const displayName = values.displayName;
  if (!legalName || !displayName) return { status: 'error', key: 'errors.required' };
  if (values.wilayaCode && !isWilayaCode(values.wilayaCode)) return { status: 'error', key: 'errors.wilaya' };
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return { status: 'error', key: 'errors.email' };

  const warnings: string[] = [];
  for (const field of TEXT_FIELDS) {
    const rule = WARN_FORMATS[field];
    const v = values[field];
    if (rule && v && !rule.re.test(v)) warnings.push(rule.key);
  }

  const logo = formData.get('logo');
  const logoFile = logo instanceof File && logo.size > 0 ? logo : null;
  const logoBytes = logoFile ? new Uint8Array(await logoFile.arrayBuffer()) : null;

  try {
    return await withTenant(tenant.value, async (ctx) => {
      const [before] = await ctx.tx.select().from(companies).where(eq(companies.id, ctx.companyId));
      if (!before) return { status: 'error' as const, key: 'errors.notFound' };

      // legal and trade names are NOT NULL columns; the checks above guarantee they are strings.
      const patch = { ...values, legalName, displayName };
      if (logoFile && logoBytes) {
        const up = await uploadFile(ctx, {
          entity: 'companies',
          recordId: ctx.companyId,
          fileName: logoFile.name || 'logo',
          contentType: logoFile.type,
          bytes: logoBytes,
          kind: 'company_logo',
        });
        if (!up.ok) return { status: 'error' as const, key: up.error.code === 'VALIDATION' ? 'errors.logo' : 'errors.save' };
        await ctx.tx.update(companies).set({ logoFileId: up.value.id }).where(eq(companies.id, ctx.companyId));
      }

      await ctx.tx.update(companies).set({ ...patch, updatedAt: new Date() }).where(eq(companies.id, ctx.companyId));

      const after = { ...before, ...patch };
      const changed = TEXT_FIELDS.filter((f) => String(before[f] ?? '') !== String(after[f] ?? ''));
      await audit(ctx, {
        entity: 'core.company',
        recordId: ctx.companyId,
        action: 'update',
        before: Object.fromEntries(changed.map((f) => [f, before[f]])),
        after: Object.fromEntries(changed.map((f) => [f, after[f]])),
      });
      return { status: 'saved' as const, warnings };
    });
  } catch (e: unknown) {
    // Unique indexes on nif and rc: a duplicate is a user error, not an internal one.
    const code = (e as { code?: string } | null)?.code;
    return { status: 'error', key: code === '23505' ? 'errors.duplicate' : 'errors.save' };
  }
}
