import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { websiteSettings, type WebsiteSettings } from '../schema';
import { isValidSlug, normalizeWhatsappPhone } from './rules';

const emptyToUndefined = (v: unknown): unknown => (typeof v === 'string' ? v.trim() || undefined : v);
// Checkbox input: an HTML checkbox sends "on" when checked and nothing otherwise.
const flag = z.preprocess((v) => v === true || v === 'on' || v === 'true', z.boolean());

export const settingsInput = z.object({
  slug: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.string().refine(isValidSlug, { message: 'invalid slug' }),
  ),
  enabled: flag,
  title: z.preprocess(emptyToUndefined, z.string().max(120)),
  about: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  phoneWhatsapp: z.preprocess(emptyToUndefined, z.string().max(30).optional()),
  showPrices: flag,
});

export type SettingsInput = z.infer<typeof settingsInput>;

export async function getSettings(ctx: Ctx): Promise<Result<WebsiteSettings | null>> {
  const perm = requirePerm(ctx, 'website.settings.read');
  if (!perm.ok) return perm;
  const [row] = await ctx.tx
    .select()
    .from(websiteSettings)
    .where(eq(websiteSettings.companyId, ctx.companyId))
    .limit(1);
  return ok(row ?? null);
}

/** Creates or updates the storefront settings of the active company. */
export async function saveSettings(ctx: Ctx, input: SettingsInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'website.settings.write');
  if (!perm.ok) return perm;

  if (!input.title.trim()) return err('VALIDATION', 'title is required', { field: 'title' });
  let phoneWhatsapp: string | null = null;
  if (input.phoneWhatsapp) {
    const normalized = normalizeWhatsappPhone(input.phoneWhatsapp);
    if (!normalized) return err('VALIDATION', 'invalid WhatsApp number', { field: 'phoneWhatsapp' });
    phoneWhatsapp = normalized;
  }

  // Slugs are global because the public URL carries no tenant.
  const [taken] = await ctx.tx
    .select({ id: websiteSettings.id })
    .from(websiteSettings)
    .where(and(eq(websiteSettings.slug, input.slug), ne(websiteSettings.companyId, ctx.companyId)))
    .limit(1);
  if (taken) return err('CONFLICT', 'slug already used', { field: 'slug' });

  const [existing] = await ctx.tx
    .select()
    .from(websiteSettings)
    .where(eq(websiteSettings.companyId, ctx.companyId))
    .for('update');

  const values = {
    slug: input.slug,
    enabled: input.enabled,
    title: input.title.trim(),
    about: input.about ?? null,
    phoneWhatsapp,
    showPrices: input.showPrices,
    updatedAt: new Date(),
  };

  if (existing) {
    await ctx.tx.update(websiteSettings).set(values).where(eq(websiteSettings.id, existing.id));
    await audit(ctx, { action: 'update', entity: 'website.settings', recordId: existing.id, before: existing, after: values });
    return ok({ id: existing.id });
  }

  const [row] = await ctx.tx
    .insert(websiteSettings)
    .values({ ...values, companyId: ctx.companyId, createdBy: ctx.userId })
    .returning({ id: websiteSettings.id });
  if (!row) return err('INTERNAL', 'insert failed');
  await audit(ctx, { action: 'create', entity: 'website.settings', recordId: row.id, after: values });
  return ok({ id: row.id });
}
