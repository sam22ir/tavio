import { and, asc, eq, isNull } from 'drizzle-orm';
import { audit } from '@/core/audit';
import type { Ctx } from '@/core/ctx';
import { requirePerm } from '@/core/perms';
import { err, ok, type Result } from '@/core/result';
import { stockLocations, warehouses, type StockLocation, type Warehouse } from '../schema';

export const DEFAULT_WAREHOUSE_CODE = 'WH';
const WILAYA_RE = /^(0[1-9]|[1-4]\d|5[0-8])$/;

export interface WarehouseInput {
  code: string;
  name: string;
  wilayaCode?: string;
}

export interface DefaultLocations {
  warehouseId: string;
  internalLocationId: string;
  customerLocationId: string;
  supplierLocationId: string;
  inventoryLossLocationId: string;
}

/** Normalises and validates a warehouse input. Returns an error when a field is invalid. */
export function normalizeWarehouse(input: WarehouseInput): Result<WarehouseInput> {
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  if (!/^[A-Z0-9_-]{1,12}$/.test(code)) return err('VALIDATION', 'Invalid warehouse code');
  if (name.length === 0 || name.length > 120) return err('VALIDATION', 'Invalid warehouse name');
  const wilaya = input.wilayaCode?.trim() || undefined;
  if (wilaya !== undefined && !WILAYA_RE.test(wilaya)) return err('VALIDATION', 'Invalid wilaya');
  return ok({ code, name, wilayaCode: wilaya });
}

/** Creates a company-wide location if it does not exist yet, and returns its id. */
async function ensureGlobalLocation(ctx: Ctx, type: 'customer' | 'supplier' | 'inventory_loss', name: string): Promise<string> {
  const [existing] = await ctx.tx
    .select({ id: stockLocations.id })
    .from(stockLocations)
    .where(
      and(
        eq(stockLocations.companyId, ctx.companyId),
        eq(stockLocations.type, type),
        isNull(stockLocations.warehouseId),
      ),
    );
  if (existing) return existing.id;
  const [created] = await ctx.tx
    .insert(stockLocations)
    .values({ companyId: ctx.companyId, createdBy: ctx.userId, type, name, warehouseId: null })
    .returning({ id: stockLocations.id });
  if (!created) throw new Error('stock location insert returned no row');
  return created.id;
}

/** Creates the internal location of a warehouse if missing, and returns its id. */
async function ensureInternalLocation(ctx: Ctx, warehouseId: string, name: string): Promise<string> {
  const [existing] = await ctx.tx
    .select({ id: stockLocations.id })
    .from(stockLocations)
    .where(and(eq(stockLocations.companyId, ctx.companyId), eq(stockLocations.warehouseId, warehouseId), eq(stockLocations.type, 'internal')));
  if (existing) return existing.id;
  const [created] = await ctx.tx
    .insert(stockLocations)
    .values({ companyId: ctx.companyId, createdBy: ctx.userId, type: 'internal', name, warehouseId })
    .returning({ id: stockLocations.id });
  if (!created) throw new Error('stock location insert returned no row');
  return created.id;
}

/**
 * Makes sure the company has a default warehouse and the internal, customer, supplier and
 * inventory_loss locations. Safe to call repeatedly. Used by event handlers, so no permission check.
 */
export async function ensureDefaultWarehouse(ctx: Ctx): Promise<DefaultLocations> {
  let [warehouse] = await ctx.tx
    .select()
    .from(warehouses)
    .where(and(eq(warehouses.companyId, ctx.companyId), eq(warehouses.code, DEFAULT_WAREHOUSE_CODE)));
  if (!warehouse) {
    [warehouse] = await ctx.tx
      .insert(warehouses)
      .values({ companyId: ctx.companyId, createdBy: ctx.userId, code: DEFAULT_WAREHOUSE_CODE, name: 'Main warehouse' })
      .returning();
  }
  if (!warehouse) throw new Error('warehouse insert returned no row');

  const internalLocationId = await ensureInternalLocation(ctx, warehouse.id, warehouse.name);
  return {
    warehouseId: warehouse.id,
    internalLocationId,
    customerLocationId: await ensureGlobalLocation(ctx, 'customer', 'Customers'),
    supplierLocationId: await ensureGlobalLocation(ctx, 'supplier', 'Suppliers'),
    inventoryLossLocationId: await ensureGlobalLocation(ctx, 'inventory_loss', 'Inventory adjustments'),
  };
}

export async function listWarehouses(ctx: Ctx): Promise<Result<Warehouse[]>> {
  const perm = requirePerm(ctx, 'inventory.warehouse.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select()
    .from(warehouses)
    .where(eq(warehouses.companyId, ctx.companyId))
    .orderBy(asc(warehouses.code));
  return ok(rows);
}

/** Creates a warehouse together with its internal stock location. */
export async function createWarehouse(ctx: Ctx, input: WarehouseInput): Promise<Result<{ warehouseId: string }>> {
  const perm = requirePerm(ctx, 'inventory.warehouse.write');
  if (!perm.ok) return perm;
  const norm = normalizeWarehouse(input);
  if (!norm.ok) return norm;

  const [dup] = await ctx.tx
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(and(eq(warehouses.companyId, ctx.companyId), eq(warehouses.code, norm.value.code)));
  if (dup) return err('CONFLICT', 'Warehouse code already used');

  const [created] = await ctx.tx
    .insert(warehouses)
    .values({
      companyId: ctx.companyId,
      createdBy: ctx.userId,
      code: norm.value.code,
      name: norm.value.name,
      wilayaCode: norm.value.wilayaCode ?? null,
    })
    .returning();
  if (!created) throw new Error('warehouse insert returned no row');
  await ensureInternalLocation(ctx, created.id, created.name);
  await audit(ctx, { entity: 'inventory.warehouse', recordId: created.id, action: 'create', after: norm.value });
  return ok({ warehouseId: created.id });
}

export async function listLocations(ctx: Ctx): Promise<Result<StockLocation[]>> {
  const perm = requirePerm(ctx, 'inventory.move.read');
  if (!perm.ok) return perm;
  const rows = await ctx.tx
    .select()
    .from(stockLocations)
    .where(eq(stockLocations.companyId, ctx.companyId))
    .orderBy(asc(stockLocations.type), asc(stockLocations.name));
  return ok(rows);
}
