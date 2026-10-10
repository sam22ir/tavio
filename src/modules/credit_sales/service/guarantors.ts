// Guarantors (cautions solidaires) on a credit contract (W15-B). Edited only while the contract is draft or approved.
import { and, asc, eq } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { uploadFile } from '@/core/files/service';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { postMessage } from '@/modules/chatter/service';
import { creditGuarantors } from '../schema';
import { loadContractForUpdate } from './contracts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTITY = 'credit_sales.guarantor';
const CONTRACT_ENTITY = 'credit_sales.contract';
const EDIT_STATES = ['draft', 'approved'] as const;
const NIN_RE = /^[0-9A-Za-z -]{3,40}$/;

export interface IdDocumentInput {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
}

export interface GuarantorInput {
  fullName: string;
  nin: string;
  phone?: string | null;
  address?: string | null;
  relation?: string | null;
  /** Optional ID document. Stored in the encrypted id-photo bucket through core/files. */
  idDocument?: IdDocumentInput | null;
}

export interface GuarantorFields {
  fullName: string;
  nin: string;
  phone: string | null;
  address: string | null;
  relation: string | null;
}

export interface GuarantorRow extends GuarantorFields {
  id: string;
  hasIdDocument: boolean;
}

/** Pure: trims and checks guarantor fields. Returns the normalized values or a VALIDATION error. */
export function normalizeGuarantor(input: GuarantorInput): Result<GuarantorFields> {
  const fullName = input.fullName.trim();
  if (fullName === '' || fullName.length > 120) return err('VALIDATION', 'Full name must be 1 to 120 characters', { field: 'fullName' });
  const nin = input.nin.trim();
  if (!NIN_RE.test(nin)) return err('VALIDATION', 'NIN must be 3 to 40 letters or digits', { field: 'nin' });
  const phone = input.phone?.trim() || null;
  if (phone !== null && phone.length > 30) return err('VALIDATION', 'Phone is too long', { field: 'phone' });
  const address = input.address?.trim() || null;
  if (address !== null && address.length > 300) return err('VALIDATION', 'Address is too long', { field: 'address' });
  const relation = input.relation?.trim() || null;
  if (relation !== null && relation.length > 60) return err('VALIDATION', 'Relationship is too long', { field: 'relation' });
  return ok({ fullName, nin, phone, address, relation });
}

function fieldNames(fields: GuarantorFields, hasDocument: boolean): string[] {
  return [...Object.keys(fields), ...(hasDocument ? ['idDocument'] : [])];
}

async function assertEditable(ctx: Ctx, contractId: string): Promise<Result<void>> {
  const loaded = await loadContractForUpdate(ctx, contractId);
  if (!loaded.ok) return loaded;
  if (!(EDIT_STATES as readonly string[]).includes(loaded.value.state)) {
    return err('STATE', 'Guarantors can only be changed while the contract is draft or approved');
  }
  return ok(undefined);
}

export async function listGuarantors(ctx: Ctx, contractId: string): Promise<Result<GuarantorRow[]>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.read');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(contractId)) return err('NOT_FOUND', 'Contract not found');
  const rows = await ctx.tx
    .select({
      id: creditGuarantors.id,
      fullName: creditGuarantors.fullName,
      nin: creditGuarantors.nin,
      phone: creditGuarantors.phone,
      address: creditGuarantors.address,
      relation: creditGuarantors.relation,
      idPhotoFileId: creditGuarantors.idPhotoFileId,
    })
    .from(creditGuarantors)
    .where(and(eq(creditGuarantors.companyId, ctx.companyId), eq(creditGuarantors.contractId, contractId)))
    .orderBy(asc(creditGuarantors.createdAt));
  return ok(rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    nin: r.nin,
    phone: r.phone,
    address: r.address,
    relation: r.relation,
    hasIdDocument: r.idPhotoFileId !== null,
  })));
}

export async function addGuarantor(ctx: Ctx, contractId: string, input: GuarantorInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.write');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(contractId)) return err('NOT_FOUND', 'Contract not found');
  const fields = normalizeGuarantor(input);
  if (!fields.ok) return fields;
  const editable = await assertEditable(ctx, contractId);
  if (!editable.ok) return editable;

  const [row] = await ctx.tx
    .insert(creditGuarantors)
    .values({ companyId: ctx.companyId, createdBy: ctx.userId, contractId, ...fields.value })
    .returning({ id: creditGuarantors.id });
  if (!row) return err('INTERNAL', 'Insert returned no row');

  if (input.idDocument) {
    const up = await uploadFile(ctx, {
      entity: ENTITY,
      recordId: row.id,
      fileName: input.idDocument.fileName,
      contentType: input.idDocument.contentType,
      bytes: input.idDocument.bytes,
      kind: 'id_photo',
    });
    if (!up.ok) return up;
    await ctx.tx.update(creditGuarantors).set({ idPhotoFileId: up.value.id, updatedAt: new Date() }).where(eq(creditGuarantors.id, row.id));
  }

  await audit(ctx, { entity: ENTITY, recordId: row.id, action: 'create', after: { contractId, fields: fieldNames(fields.value, !!input.idDocument) } });
  const posted = await postMessage(ctx, { entity: CONTRACT_ENTITY, recordId: contractId, body: 'Guarantor added', kind: 'system' });
  if (!posted.ok) return posted;
  return ok({ id: row.id });
}

export async function updateGuarantor(ctx: Ctx, guarantorId: string, input: GuarantorInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.write');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(guarantorId)) return err('NOT_FOUND', 'Guarantor not found');
  const fields = normalizeGuarantor(input);
  if (!fields.ok) return fields;

  const [current] = await ctx.tx
    .select()
    .from(creditGuarantors)
    .where(and(eq(creditGuarantors.id, guarantorId), eq(creditGuarantors.companyId, ctx.companyId)))
    .for('update');
  if (!current) return err('NOT_FOUND', 'Guarantor not found');
  const editable = await assertEditable(ctx, current.contractId);
  if (!editable.ok) return editable;

  let idPhotoFileId = current.idPhotoFileId;
  if (input.idDocument) {
    const up = await uploadFile(ctx, {
      entity: ENTITY,
      recordId: guarantorId,
      fileName: input.idDocument.fileName,
      contentType: input.idDocument.contentType,
      bytes: input.idDocument.bytes,
      kind: 'id_photo',
    });
    if (!up.ok) return up;
    idPhotoFileId = up.value.id;
  }

  await ctx.tx
    .update(creditGuarantors)
    .set({ ...fields.value, idPhotoFileId, updatedAt: new Date() })
    .where(eq(creditGuarantors.id, guarantorId));
  const changed: string[] = (['fullName', 'nin', 'phone', 'address', 'relation'] as const)
    .filter((k) => current[k] !== fields.value[k]);
  if (input.idDocument) changed.push('idDocument');
  await audit(ctx, { entity: ENTITY, recordId: guarantorId, action: 'update', after: { fields: changed } });
  const posted = await postMessage(ctx, { entity: CONTRACT_ENTITY, recordId: current.contractId, body: 'Guarantor updated', kind: 'system' });
  if (!posted.ok) return posted;
  return ok({ id: guarantorId });
}

export async function removeGuarantor(ctx: Ctx, guarantorId: string): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.write');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(guarantorId)) return err('NOT_FOUND', 'Guarantor not found');
  const [current] = await ctx.tx
    .select()
    .from(creditGuarantors)
    .where(and(eq(creditGuarantors.id, guarantorId), eq(creditGuarantors.companyId, ctx.companyId)))
    .for('update');
  if (!current) return err('NOT_FOUND', 'Guarantor not found');
  const editable = await assertEditable(ctx, current.contractId);
  if (!editable.ok) return editable;

  await ctx.tx.delete(creditGuarantors).where(eq(creditGuarantors.id, guarantorId));
  await audit(ctx, { entity: ENTITY, recordId: guarantorId, action: 'delete', before: { contractId: current.contractId } });
  const posted = await postMessage(ctx, { entity: CONTRACT_ENTITY, recordId: current.contractId, body: 'Guarantor removed', kind: 'system' });
  if (!posted.ok) return posted;
  return ok({ id: guarantorId });
}
