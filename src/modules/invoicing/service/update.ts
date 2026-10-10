import { and, eq } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { invoiceLines, invoices } from '../schema';
import { assertPeriodOpen } from '@/modules/l10n_dz';
import { planDraft, type NewInvoice } from './create';

/**
 * Replaces the header and every line of a DRAFT invoice, then recomputes totals.
 * Posted or cancelled documents return POSTED_IMMUTABLE. The document type cannot change.
 */
export async function updateDraftInvoice(ctx: Ctx, id: string, input: NewInvoice): Promise<Result<{ id: string }>> {
  const perm = requirePerm(ctx, 'invoicing.invoice.write');
  if (!perm.ok) return perm;

  const [current] = await ctx.tx
    .select({ id: invoices.id, state: invoices.state, type: invoices.type, date: invoices.date })
    .from(invoices)
    .where(and(eq(invoices.companyId, ctx.companyId), eq(invoices.id, id)))
    .for('update');
  if (!current) return err('NOT_FOUND', 'invoice not found');
  if (current.state !== 'draft') return err('POSTED_IMMUTABLE', 'only drafts can be edited');
  if (current.type !== input.type) return err('VALIDATION', 'document type cannot change', { field: 'type' });

  const plan = await planDraft(ctx, input);
  if (!plan.ok) return plan;
  const { value } = plan;

  // A validated G50 month locks both the current date and the date the draft is moved to.
  const lockedNow = await assertPeriodOpen(ctx, current.date);
  if (!lockedNow.ok) return lockedNow;
  const lockedNew = await assertPeriodOpen(ctx, value.date);
  if (!lockedNew.ok) return lockedNew;

  await ctx.tx
    .update(invoices)
    .set({
      partnerId: input.partnerId,
      date: value.date,
      dueDate: value.dueDate,
      untaxedCents: value.untaxedCents,
      taxCents: value.taxCents,
      totalCents: value.untaxedCents + value.taxCents,
      updatedAt: new Date(),
    })
    .where(and(eq(invoices.companyId, ctx.companyId), eq(invoices.id, id), eq(invoices.state, 'draft')));

  await ctx.tx
    .delete(invoiceLines)
    .where(and(eq(invoiceLines.companyId, ctx.companyId), eq(invoiceLines.invoiceId, id)));
  await ctx.tx.insert(invoiceLines).values(
    value.lineRows.map((r) => ({ ...r, companyId: ctx.companyId, invoiceId: id, createdBy: ctx.userId })),
  );

  await audit(ctx, {
    entity: 'invoicing.invoice',
    recordId: id,
    action: 'update',
    before: { state: 'draft' },
    after: { partnerId: input.partnerId, lineCount: value.lineRows.length, totalCents: (value.untaxedCents + value.taxCents).toString() },
  });
  return ok({ id });
}
