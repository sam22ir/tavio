import { and, eq } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { portalAccessTokens } from '@/core/db/schema/portal';
import type { Tx } from '@/core/db/types';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { postMessage } from '@/modules/chatter/service';
import { partners } from '@/modules/contacts/schema';
import { creditContracts } from '@/modules/credit_sales/schema';
import { invoices } from '@/modules/invoicing/schema';
import { readPortalBaseUrl } from './env';
import {
  generatePortalToken,
  hashPortalToken,
  portalTokenUrl,
  ttlMsFor,
  type PortalPurpose,
  type PortalTarget,
} from './tokens';

export interface CreatePortalLinkInput {
  partnerId: string;
  /** Present for a document link (30 days). Absent for a login link (30 minutes, single use). */
  target?: PortalTarget;
}

export interface CreatedPortalLink {
  url: string;
  purpose: PortalPurpose;
  expiresAt: Date;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Inserts a token row in the caller's transaction. Returns the raw token (shown once) and the row id. */
export async function issuePortalToken(
  tx: Tx,
  input: {
    companyId: string;
    partnerId: string;
    purpose: PortalPurpose;
    target?: PortalTarget;
    createdBy: string | null;
    now?: Date;
  },
): Promise<{ id: string; token: string; expiresAt: Date }> {
  const now = input.now ?? new Date();
  const token = generatePortalToken(input.companyId);
  const expiresAt = new Date(now.getTime() + ttlMsFor(input.purpose));
  const [row] = await tx
    .insert(portalAccessTokens)
    .values({
      companyId: input.companyId,
      partnerId: input.partnerId,
      tokenHash: hashPortalToken(token),
      purpose: input.purpose,
      targetEntity: input.target?.entity ?? null,
      targetId: input.target?.id ?? null,
      expiresAt,
      createdBy: input.createdBy,
    })
    .returning({ id: portalAccessTokens.id });
  if (!row) throw new Error('portal token insert returned no row');
  return { id: row.id, token, expiresAt };
}

/** Staff action: creates a portal link for a partner, audited and noted in chatter. */
export async function createPortalLink(ctx: Ctx, input: CreatePortalLinkInput): Promise<Result<CreatedPortalLink>> {
  const perm = input.target
    ? requirePerm(ctx, input.target.entity === 'invoicing.invoice' ? 'invoicing.invoice.read' : 'credit_sales.contract.read')
    : requirePerm(ctx, 'contacts.partner.write');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(input.partnerId)) return err('NOT_FOUND', 'partner not found');

  const [partner] = await ctx.tx
    .select({ id: partners.id, active: partners.active })
    .from(partners)
    .where(and(eq(partners.companyId, ctx.companyId), eq(partners.id, input.partnerId)));
  if (!partner || !partner.active) return err('NOT_FOUND', 'partner not found');

  if (input.target) {
    const owned = input.target.entity === 'invoicing.invoice'
      ? await ctx.tx.select({ id: invoices.id }).from(invoices).where(and(
        eq(invoices.companyId, ctx.companyId), eq(invoices.id, input.target.id), eq(invoices.partnerId, partner.id),
      ))
      : await ctx.tx.select({ id: creditContracts.id }).from(creditContracts).where(and(
        eq(creditContracts.companyId, ctx.companyId), eq(creditContracts.id, input.target.id), eq(creditContracts.partnerId, partner.id),
      ));
    if (owned.length === 0) return err('NOT_FOUND', 'document not found for this partner');
  }

  const base = readPortalBaseUrl();
  if (!base) return err('INTERNAL', 'PORTAL_BASE_URL or BETTER_AUTH_URL must be set');

  const purpose: PortalPurpose = input.target ? 'document' : 'login';
  const issued = await issuePortalToken(ctx.tx, {
    companyId: ctx.companyId,
    partnerId: partner.id,
    purpose,
    target: input.target,
    createdBy: ctx.userId,
  });

  await audit(ctx, {
    action: 'portal_link_created',
    entity: 'portal.access',
    recordId: issued.id,
    after: { purpose, partnerId: partner.id, target: input.target ?? null, expiresAt: issued.expiresAt.toISOString() },
  });

  // Chatter note. Never contains the token. A failed note does not block the link.
  const noteEntity = input.target?.entity ?? 'contacts.partner';
  const noteRecord = input.target?.id ?? partner.id;
  const body = purpose === 'document'
    ? `Lien portail (document) créé, valide jusqu'au ${issued.expiresAt.toISOString().slice(0, 10)}.`
    : 'Lien de connexion au portail créé (valide 30 minutes, usage unique).';
  await postMessage(ctx, { entity: noteEntity, recordId: noteRecord, body, kind: 'note' });

  return ok({
    url: portalTokenUrl(base, ctx.locale, issued.token),
    purpose,
    expiresAt: issued.expiresAt,
  });
}
