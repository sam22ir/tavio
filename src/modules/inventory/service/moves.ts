import { alias } from 'drizzle-orm/pg-core';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { emit } from '@/core/events';
import type { StockMoveDone } from '@/core/events/catalog';
import { nextNumber } from '@/core/sequences';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { products } from '@/modules/products/schema';
import { stockLocations, stockMoves } from '../schema';
import { fromMilli, parsePositiveQty, toMilli } from './quantity';

export const MOVE_STATES = ['draft', 'done', 'cancelled'] as const;
export type MoveState = (typeof MOVE_STATES)[number];

export interface CreateMoveInput {
  productId: string;
  quantity: string;
  fromLocationId: string;
  toLocationId: string;
  reference?: string;
}

export interface MoveRow {
  id: string;
  reference: string;
  productId: string;
  productName: string;
  quantity: string;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  state: MoveState;
  sourceEntity: string | null;
  sourceId: string | null;
  doneAt: string | null;
}

export interface LineInput {
  productId: string | null;
  quantity: string;
}

/** Inserts a draft move without a permission check. Used by services and event handlers. */
async function insertDraftMove(
  ctx: Ctx,
  values: {
    reference: string;
    productId: string;
    quantity: string;
    fromLocationId: string;
    toLocationId: string;
    sourceEntity?: string;
    sourceId?: string;
  },
): Promise<string> {
  const { sourceEntity, sourceId, ...rest } = values;
  const [row] = await ctx.tx
    .insert(stockMoves)
    .values({
      ...rest,
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      state: 'draft',
      sourceEntity: sourceEntity ?? null,
      sourceId: sourceId ?? null,
    })
    .returning({ id: stockMoves.id });
  if (!row) throw new Error('stock move insert returned no row');
  return row.id;
}

/** Marks a draft move done, audits it and emits inventory.move.done in the same transaction. */
export async function postMove(ctx: Ctx, moveId: string): Promise<Result<void>> {
  const [move] = await ctx.tx
    .select()
    .from(stockMoves)
    .where(and(eq(stockMoves.id, moveId), eq(stockMoves.companyId, ctx.companyId)))
    .for('update');
  if (!move) return err('NOT_FOUND', 'Stock move not found');
  if (move.state !== 'draft') return err('CONFLICT', 'Only draft moves can be validated');

  await ctx.tx
    .update(stockMoves)
    .set({ state: 'done', doneAt: sql`now()`, updatedAt: sql`now()` })
    .where(eq(stockMoves.id, move.id));
  await audit(ctx, {
    entity: 'inventory.move',
    recordId: move.id,
    action: 'validate',
    before: { state: 'draft' },
    after: { state: 'done', quantity: move.quantity },
  });
  const event: StockMoveDone = {
    moveId: move.id,
    productId: move.productId,
    quantity: move.quantity,
    fromLocationId: move.fromLocationId,
    toLocationId: move.toLocationId,
  };
  await emit(ctx, { name: 'inventory.move.done', payload: event });
  return ok(undefined);
}

/** Finds a live (not cancelled) move created for a source document line. */
export async function findMoveBySource(
  ctx: Ctx,
  sourceEntity: string,
  sourceId: string,
  productId: string,
): Promise<string | null> {
  const [row] = await ctx.tx
    .select({ id: stockMoves.id })
    .from(stockMoves)
    .where(
      and(
        eq(stockMoves.companyId, ctx.companyId),
        eq(stockMoves.sourceEntity, sourceEntity),
        eq(stockMoves.sourceId, sourceId),
        eq(stockMoves.productId, productId),
        ne(stockMoves.state, 'cancelled'),
      ),
    );
  return row?.id ?? null;
}

/**
 * Creates one move per product from document lines (sums repeated products, skips lines without a
 * product, and skips products that already have a move for this source). Posts the moves when
 * `post` is true. Idempotent, so event redelivery creates nothing new.
 */
export async function moveLines(
  ctx: Ctx,
  input: {
    lines: readonly LineInput[];
    sourceEntity: string;
    sourceId: string;
    reference: string;
    fromLocationId: string;
    toLocationId: string;
    post: boolean;
  },
): Promise<Result<{ created: number }>> {
  const totals = new Map<string, bigint>();
  for (const line of input.lines) {
    if (!line.productId) continue;
    const milli = toMilli(line.quantity);
    if (milli === null || milli <= 0n) continue;
    totals.set(line.productId, (totals.get(line.productId) ?? 0n) + milli);
  }

  let created = 0;
  for (const [productId, milli] of totals) {
    if (await findMoveBySource(ctx, input.sourceEntity, input.sourceId, productId)) continue;
    const moveId = await insertDraftMove(ctx, {
      reference: input.reference,
      productId,
      quantity: fromMilli(milli),
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      sourceEntity: input.sourceEntity,
      sourceId: input.sourceId,
    });
    if (input.post) {
      const posted = await postMove(ctx, moveId);
      if (!posted.ok) return posted;
    }
    created += 1;
  }
  return ok({ created });
}

async function assertLocationAndProduct(
  ctx: Ctx,
  productId: string,
  locationIds: readonly string[],
): Promise<Result<void>> {
  const [product] = await ctx.tx
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.companyId, ctx.companyId)));
  if (!product) return err('NOT_FOUND', 'Product not found');
  for (const id of locationIds) {
    const [loc] = await ctx.tx
      .select({ id: stockLocations.id })
      .from(stockLocations)
      .where(and(eq(stockLocations.id, id), eq(stockLocations.companyId, ctx.companyId)));
    if (!loc) return err('NOT_FOUND', 'Stock location not found');
  }
  return ok(undefined);
}

/** Creates a draft move that a user validates later. */
export async function createMove(ctx: Ctx, input: CreateMoveInput): Promise<Result<{ moveId: string; reference: string }>> {
  const perm = requirePerm(ctx, 'inventory.move.write');
  if (!perm.ok) return perm;
  const quantity = parsePositiveQty(input.quantity);
  if (quantity === null) return err('VALIDATION', 'Invalid quantity');
  if (input.fromLocationId === input.toLocationId) {
    return err('VALIDATION', 'Source and destination are the same');
  }
  const check = await assertLocationAndProduct(ctx, input.productId, [input.fromLocationId, input.toLocationId]);
  if (!check.ok) return check;

  const reference = input.reference?.trim() || (await nextNumber(ctx, 'inventory.move', { prefix: 'MV{YYYY}/', padding: 5 }));
  const moveId = await insertDraftMove(ctx, {
    reference,
    productId: input.productId,
    quantity,
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId,
  });
  await audit(ctx, { entity: 'inventory.move', recordId: moveId, action: 'create', after: { reference, quantity } });
  return ok({ moveId, reference });
}

/** Validates a draft move: it becomes done, and inventory.move.done is emitted. */
export async function validateMove(ctx: Ctx, moveId: string): Promise<Result<void>> {
  const perm = requirePerm(ctx, 'inventory.move.post');
  if (!perm.ok) return perm;
  return postMove(ctx, moveId);
}

/** Cancels a draft move. Done moves are part of the stock ledger and cannot be cancelled. */
export async function cancelMove(ctx: Ctx, moveId: string): Promise<Result<void>> {
  const perm = requirePerm(ctx, 'inventory.move.cancel');
  if (!perm.ok) return perm;
  const [move] = await ctx.tx
    .select()
    .from(stockMoves)
    .where(and(eq(stockMoves.id, moveId), eq(stockMoves.companyId, ctx.companyId)))
    .for('update');
  if (!move) return err('NOT_FOUND', 'Stock move not found');
  if (move.state === 'done') return err('POSTED_IMMUTABLE', 'Done moves cannot be cancelled');
  if (move.state === 'cancelled') return ok(undefined);
  await ctx.tx
    .update(stockMoves)
    .set({ state: 'cancelled', updatedAt: sql`now()` })
    .where(eq(stockMoves.id, move.id));
  await audit(ctx, { entity: 'inventory.move', recordId: move.id, action: 'cancel', before: { state: 'draft' }, after: { state: 'cancelled' } });
  return ok(undefined);
}

function moveSelect() {
  const from = alias(stockLocations, 'from_loc');
  const to = alias(stockLocations, 'to_loc');
  return {
    from,
    to,
    columns: {
      id: stockMoves.id,
      reference: stockMoves.reference,
      productId: stockMoves.productId,
      productName: products.name,
      quantity: stockMoves.quantity,
      fromLocationId: stockMoves.fromLocationId,
      fromLocationName: from.name,
      toLocationId: stockMoves.toLocationId,
      toLocationName: to.name,
      state: stockMoves.state,
      sourceEntity: stockMoves.sourceEntity,
      sourceId: stockMoves.sourceId,
      doneAt: stockMoves.doneAt,
    },
  };
}

function toMoveRow(row: {
  id: string; reference: string; productId: string; productName: string; quantity: string;
  fromLocationId: string; fromLocationName: string; toLocationId: string; toLocationName: string;
  state: string; sourceEntity: string | null; sourceId: string | null; doneAt: Date | null;
}): MoveRow {
  return {
    ...row,
    state: row.state as MoveState,
    doneAt: row.doneAt ? row.doneAt.toISOString() : null,
  };
}

export async function listMoves(ctx: Ctx, opts: { state?: MoveState; limit?: number } = {}): Promise<Result<MoveRow[]>> {
  const perm = requirePerm(ctx, 'inventory.move.read');
  if (!perm.ok) return perm;
  const { from, to, columns } = moveSelect();
  const where = and(
    eq(stockMoves.companyId, ctx.companyId),
    opts.state ? eq(stockMoves.state, opts.state) : undefined,
  );
  const rows = await ctx.tx
    .select(columns)
    .from(stockMoves)
    .innerJoin(products, eq(products.id, stockMoves.productId))
    .innerJoin(from, eq(from.id, stockMoves.fromLocationId))
    .innerJoin(to, eq(to.id, stockMoves.toLocationId))
    .where(where)
    .orderBy(desc(stockMoves.createdAt), desc(stockMoves.id))
    .limit(Math.min(Math.max(opts.limit ?? 100, 1), 200));
  return ok(rows.map(toMoveRow));
}

export async function getMove(ctx: Ctx, moveId: string): Promise<Result<MoveRow>> {
  const perm = requirePerm(ctx, 'inventory.move.read');
  if (!perm.ok) return perm;
  const { from, to, columns } = moveSelect();
  const [row] = await ctx.tx
    .select(columns)
    .from(stockMoves)
    .innerJoin(products, eq(products.id, stockMoves.productId))
    .innerJoin(from, eq(from.id, stockMoves.fromLocationId))
    .innerJoin(to, eq(to.id, stockMoves.toLocationId))
    .where(and(eq(stockMoves.id, moveId), eq(stockMoves.companyId, ctx.companyId)));
  if (!row) return err('NOT_FOUND', 'Stock move not found');
  return ok(toMoveRow(row));
}
