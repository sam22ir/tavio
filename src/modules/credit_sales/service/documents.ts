// Required documents for credit contracts (W13-CREDIT).
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { creditContractDocuments, creditDocumentRequirements } from '../schema';
import { loadContractForUpdate } from './contracts';

export const DOCUMENT_STATUSES = ['missing', 'received', 'rejected'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUIREMENT_ENTITY = 'credit_sales.document_requirement';
const DOCUMENT_ENTITY = 'credit_sales.contract_document';
const DOCUMENT_EDIT_STATES = ['submitted', 'under_review'] as const;

export interface DocumentCheck {
  documentId: string;
  name: string;
  required: boolean;
  status: string;
}

/** Pure: names of required documents that are not yet received. */
export function missingRequiredDocuments(docs: readonly DocumentCheck[]): string[] {
  return docs.filter((d) => d.required && d.status !== 'received').map((d) => d.name);
}

export interface RequirementInput {
  id?: string;
  name: string;
  required: boolean;
  active: boolean;
}

export async function listDocumentRequirements(ctx: Ctx): Promise<Result<{ id: string; name: string; required: boolean; active: boolean }[]>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select({
      id: creditDocumentRequirements.id,
      name: creditDocumentRequirements.name,
      required: creditDocumentRequirements.required,
      active: creditDocumentRequirements.active,
    })
    .from(creditDocumentRequirements)
    .where(eq(creditDocumentRequirements.companyId, ctx.companyId))
    .orderBy(asc(creditDocumentRequirements.name));
  return ok(rows);
}

export async function saveDocumentRequirement(ctx: Ctx, input: RequirementInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.write');
  if (!perm.ok) return perm;
  const name = input.name.trim();
  if (name === '' || name.length > 120) return err('VALIDATION', 'Name must be 1 to 120 characters', { field: 'name' });
  if (input.id !== undefined && !UUID_RE.test(input.id)) return err('NOT_FOUND', 'Requirement not found');

  const [clash] = await ctx.tx
    .select({ id: creditDocumentRequirements.id })
    .from(creditDocumentRequirements)
    .where(and(
      eq(creditDocumentRequirements.companyId, ctx.companyId),
      eq(creditDocumentRequirements.name, name),
      input.id ? ne(creditDocumentRequirements.id, input.id) : sql`true`,
    ));
  if (clash) return err('CONFLICT', 'A requirement with this name already exists');

  if (input.id) {
    const [row] = await ctx.tx
      .update(creditDocumentRequirements)
      .set({ name, required: input.required, active: input.active, updatedAt: new Date() })
      .where(and(eq(creditDocumentRequirements.id, input.id), eq(creditDocumentRequirements.companyId, ctx.companyId)))
      .returning({ id: creditDocumentRequirements.id });
    if (!row) return err('NOT_FOUND', 'Requirement not found');
    await audit(ctx, { entity: REQUIREMENT_ENTITY, recordId: row.id, action: 'update', after: { name, required: input.required, active: input.active } });
    return ok({ id: row.id });
  }

  const [row] = await ctx.tx
    .insert(creditDocumentRequirements)
    .values({ companyId: ctx.companyId, createdBy: ctx.userId, name, required: input.required, active: input.active })
    .returning({ id: creditDocumentRequirements.id });
  if (!row) return err('INTERNAL', 'Insert returned no row');
  await audit(ctx, { entity: REQUIREMENT_ENTITY, recordId: row.id, action: 'create', after: { name, required: input.required, active: input.active } });
  return ok({ id: row.id });
}

/** Creates one missing-status row per active requirement. Existing rows are kept. Called on submit. */
export async function createContractDocuments(ctx: Ctx, contractId: string): Promise<Result<{ created: number }>> {
  const active = await ctx.tx
    .select({ id: creditDocumentRequirements.id })
    .from(creditDocumentRequirements)
    .where(and(eq(creditDocumentRequirements.companyId, ctx.companyId), eq(creditDocumentRequirements.active, true)));
  if (active.length === 0) return ok({ created: 0 });
  const inserted = await ctx.tx
    .insert(creditContractDocuments)
    .values(active.map((r) => ({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      contractId,
      requirementId: r.id,
      status: 'missing',
    })))
    .onConflictDoNothing()
    .returning({ id: creditContractDocuments.id });
  return ok({ created: inserted.length });
}

export interface ContractDocumentRow {
  id: string;
  requirementId: string;
  name: string;
  required: boolean;
  status: string;
  fileId: string | null;
  note: string | null;
}

export async function listContractDocuments(ctx: Ctx, contractId: string): Promise<Result<ContractDocumentRow[]>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.read');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(contractId)) return err('NOT_FOUND', 'Contract not found');
  const rows = await ctx.tx
    .select({
      id: creditContractDocuments.id,
      requirementId: creditContractDocuments.requirementId,
      name: creditDocumentRequirements.name,
      required: creditDocumentRequirements.required,
      status: creditContractDocuments.status,
      fileId: creditContractDocuments.fileId,
      note: creditContractDocuments.note,
    })
    .from(creditContractDocuments)
    .innerJoin(creditDocumentRequirements, eq(creditDocumentRequirements.id, creditContractDocuments.requirementId))
    .where(and(eq(creditContractDocuments.companyId, ctx.companyId), eq(creditContractDocuments.contractId, contractId)))
    .orderBy(asc(creditDocumentRequirements.name));
  return ok(rows);
}

export interface SetDocumentInput {
  status: DocumentStatus;
  fileId?: string | null;
  note?: string | null;
}

export async function setContractDocumentStatus(ctx: Ctx, documentId: string, input: SetDocumentInput): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'credit_sales.contract.write');
  if (!perm.ok) return perm;
  if (!UUID_RE.test(documentId)) return err('NOT_FOUND', 'Document not found');
  if (!(DOCUMENT_STATUSES as readonly string[]).includes(input.status)) {
    return err('VALIDATION', 'Unknown document status', { field: 'status' });
  }
  if (input.fileId && !UUID_RE.test(input.fileId)) return err('VALIDATION', 'fileId must be a UUID', { field: 'fileId' });

  const [doc] = await ctx.tx
    .select()
    .from(creditContractDocuments)
    .where(and(eq(creditContractDocuments.id, documentId), eq(creditContractDocuments.companyId, ctx.companyId)))
    .for('update');
  if (!doc) return err('NOT_FOUND', 'Document not found');

  const contract = await loadContractForUpdate(ctx, doc.contractId);
  if (!contract.ok) return contract;
  if (!(DOCUMENT_EDIT_STATES as readonly string[]).includes(contract.value.state)) {
    return err('STATE', 'Documents can only be changed while the contract is submitted or under review');
  }

  await ctx.tx
    .update(creditContractDocuments)
    .set({
      status: input.status,
      fileId: input.fileId ?? doc.fileId,
      note: input.note?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(creditContractDocuments.id, documentId));
  await audit(ctx, {
    entity: DOCUMENT_ENTITY,
    recordId: documentId,
    action: 'update',
    before: { status: doc.status },
    after: { status: input.status },
  });
  return ok({ id: documentId });
}

/** Required documents not yet received for a contract. Empty means the contract may go to review. */
export async function requiredDocumentsMissing(ctx: Ctx, contractId: string): Promise<string[]> {
  const rows = await ctx.tx
    .select({
      documentId: creditContractDocuments.id,
      name: creditDocumentRequirements.name,
      required: creditDocumentRequirements.required,
      status: creditContractDocuments.status,
    })
    .from(creditContractDocuments)
    .innerJoin(creditDocumentRequirements, eq(creditDocumentRequirements.id, creditContractDocuments.requirementId))
    .where(and(eq(creditContractDocuments.companyId, ctx.companyId), eq(creditContractDocuments.contractId, contractId)));
  return missingRequiredDocuments(rows);
}
