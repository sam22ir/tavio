'use server';
import { z } from 'zod';
import { withPageCtx } from '@/core/actions/page-ctx';
import { err, type Result } from '@/core/result';
import { getContract } from '@/modules/credit_sales/service/contracts';
import { loadInvoice } from '@/modules/invoicing/service/invoices';
import { partners } from '@/modules/contacts/schema';
import { eq, and } from 'drizzle-orm';
import { createPortalLink, type CreatedPortalLink } from './links';

// Staff actions behind the "Partager" and "Inviter au portail" buttons.

const UUID = z.uuid();

export interface PortalShareResult {
  url: string;
  purpose: 'login' | 'document';
  expiresAt: string;
  /** Partner phone, for the WhatsApp action. Null when unset. */
  phone: string | null;
}

const DocumentForm = z.object({ kind: z.enum(['invoice', 'contract']), id: UUID });
const InviteForm = z.object({ partnerId: UUID });

function toResult(link: CreatedPortalLink, phone: string | null): PortalShareResult {
  return { url: link.url, purpose: link.purpose, expiresAt: link.expiresAt.toISOString(), phone };
}

export async function createPortalDocumentLinkAction(raw: unknown): Promise<Result<PortalShareResult>> {
  const parsed = DocumentForm.safeParse(raw);
  if (!parsed.success) return err('VALIDATION', 'invalid input');
  const { kind, id } = parsed.data;
  return withPageCtx(async (ctx): Promise<Result<PortalShareResult>> => {
    let partnerId: string;
    if (kind === 'invoice') {
      const loaded = await loadInvoice(ctx, id);
      if (!loaded.ok) return loaded;
      if (loaded.value.invoice.state !== 'posted') return err('CONFLICT', 'only posted invoices can be shared');
      partnerId = loaded.value.invoice.partnerId;
    } else {
      const loaded = await getContract(ctx, id);
      if (!loaded.ok) return loaded;
      if (loaded.value.contract.state === 'draft') return err('CONFLICT', 'draft contracts cannot be shared');
      partnerId = loaded.value.contract.partnerId;
    }
    const target = kind === 'invoice'
      ? { entity: 'invoicing.invoice' as const, id }
      : { entity: 'credit_sales.contract' as const, id };
    const link = await createPortalLink(ctx, { partnerId, target });
    if (!link.ok) return link;
    const [p] = await ctx.tx.select({ phone: partners.phone }).from(partners)
      .where(and(eq(partners.companyId, ctx.companyId), eq(partners.id, partnerId)));
    return { ok: true, value: toResult(link.value, p?.phone ?? null) };
  });
}

export async function createPortalInviteAction(raw: unknown): Promise<Result<PortalShareResult>> {
  const parsed = InviteForm.safeParse(raw);
  if (!parsed.success) return err('VALIDATION', 'invalid input');
  const partnerId = parsed.data.partnerId;
  return withPageCtx(async (ctx): Promise<Result<PortalShareResult>> => {
    const link = await createPortalLink(ctx, { partnerId });
    if (!link.ok) return link;
    const [p] = await ctx.tx.select({ phone: partners.phone }).from(partners)
      .where(and(eq(partners.companyId, ctx.companyId), eq(partners.id, partnerId)));
    return { ok: true, value: toResult(link.value, p?.phone ?? null) };
  });
}
