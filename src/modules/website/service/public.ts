// Storefront service for anonymous visitors. Must NOT use withTenant: it reads through the owner
// connection and always filters by the company_id resolved from the slug. It exposes only safe fields.
import { and, count, eq, gte, inArray, asc } from 'drizzle-orm';
import { z } from 'zod';
import type { Ctx, Locale } from '@/core/ctx';
import { getDb } from '@/core/db/client';
import { auditLog, companies } from '@/core/db/schema';
import type { Db, Tx } from '@/core/db/types';
import { sumCents, type Cents } from '@/core/money';
import { nextNumber } from '@/core/sequences';
import { err, ok, type Result } from '@/core/result';
import { products } from '@/modules/products/schema';
import { webOrders, websiteSettings } from '../schema';
import { autoConvertWebOrder } from './convert';
import {
  isRateLimited,
  isValidSlug,
  lineSubtotal,
  MAX_LINES_PER_ORDER,
  MAX_QTY_PER_LINE,
  normalizeWhatsappPhone,
  RATE_LIMIT_WINDOW_MS,
  WILAYA_RE,
} from './rules';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shop data safe to show to visitors. The company id stays server-side. */
export interface ShopPublic {
  slug: string;
  title: string;
  about: string | null;
  companyName: string;
  phoneWhatsapp: string | null;
  showPrices: boolean;
}

export interface ShopProduct {
  id: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  salePriceCents: string;
}

interface ResolvedShop {
  companyId: string;
  shop: ShopPublic;
}

/** Looks up an enabled storefront by slug. Returns null when the slug is unknown or disabled. */
export async function resolveShop(slug: string, db: Db = getDb()): Promise<ResolvedShop | null> {
  if (!isValidSlug(slug)) return null;
  const [row] = await db
    .select({
      companyId: websiteSettings.companyId,
      slug: websiteSettings.slug,
      title: websiteSettings.title,
      about: websiteSettings.about,
      phoneWhatsapp: websiteSettings.phoneWhatsapp,
      showPrices: websiteSettings.showPrices,
      companyName: companies.displayName,
    })
    .from(websiteSettings)
    .innerJoin(companies, eq(companies.id, websiteSettings.companyId))
    .where(and(eq(websiteSettings.slug, slug), eq(websiteSettings.enabled, true)))
    .limit(1);
  if (!row) return null;
  return {
    companyId: row.companyId,
    shop: {
      slug: row.slug,
      title: row.title,
      about: row.about,
      companyName: row.companyName,
      phoneWhatsapp: row.phoneWhatsapp,
      showPrices: row.showPrices,
    },
  };
}

/** Published products: active and priced above zero. */
export async function listShopProducts(companyId: string, db: Db = getDb()): Promise<ShopProduct[]> {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      nameAr: products.nameAr,
      description: products.description,
      salePriceCents: products.salePriceCents,
    })
    .from(products)
    .where(and(eq(products.companyId, companyId), eq(products.active, true)))
    .orderBy(asc(products.name));
  return rows
    .filter((r) => r.salePriceCents > BigInt(0))
    .map((r) => ({ ...r, salePriceCents: r.salePriceCents.toString() }));
}

export async function getShopProduct(
  companyId: string,
  productId: string,
  db: Db = getDb(),
): Promise<ShopProduct | null> {
  if (!UUID_RE.test(productId)) return null;
  const [row] = await db
    .select({
      id: products.id,
      name: products.name,
      nameAr: products.nameAr,
      description: products.description,
      salePriceCents: products.salePriceCents,
    })
    .from(products)
    .where(and(eq(products.companyId, companyId), eq(products.id, productId), eq(products.active, true)))
    .limit(1);
  if (!row || row.salePriceCents <= BigInt(0)) return null;
  return { ...row, salePriceCents: row.salePriceCents.toString() };
}

export const webOrderInput = z.object({
  slug: z.string().max(60),
  customerName: z.string().trim().min(2).max(100),
  phone: z.string().max(30),
  wilayaCode: z.string().regex(WILAYA_RE),
  address: z.string().trim().min(5).max(300),
  lines: z
    .array(
      z.object({
        productId: z.string().regex(UUID_RE),
        quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE),
      }),
    )
    .min(1)
    .max(MAX_LINES_PER_ORDER),
});
export type WebOrderInput = z.infer<typeof webOrderInput>;

export interface PlacedWebOrder {
  number: string;
  totalCents: string;
}

// Anonymous context for nextNumber. It has no user, so createdBy stays null.
function anonymousCtx(tx: Tx, companyId: string, locale: Locale): Ctx {
  return { userId: '', companyId, perms: new Set<string>(), locale, tx };
}

/**
 * Cash-on-delivery checkout. Prices come from the database, never from the client.
 * Naive rate limit: at most RATE_LIMIT_MAX_ORDERS orders per phone per hour.
 */
export async function placeWebOrder(raw: unknown, db: Db = getDb()): Promise<Result<PlacedWebOrder>> {
  const parsed = webOrderInput.safeParse(raw);
  if (!parsed.success) return err('VALIDATION', 'invalid order input');
  const input = parsed.data;

  const phone = normalizeWhatsappPhone(input.phone);
  if (!phone) return err('VALIDATION', 'invalid phone', { field: 'phone' });

  const resolved = await resolveShop(input.slug, db);
  if (!resolved) return err('NOT_FOUND', 'shop not found');
  const { companyId } = resolved;

  return db.transaction(async (tx): Promise<Result<PlacedWebOrder>> => {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const [recent] = await tx
      .select({ n: count() })
      .from(webOrders)
      .where(and(eq(webOrders.companyId, companyId), eq(webOrders.phone, phone), gte(webOrders.createdAt, since)));
    if (isRateLimited(Number(recent?.n ?? 0))) {
      return err('CONFLICT', 'too many orders', { reason: 'RATE_LIMITED' });
    }

    const productIds = [...new Set(input.lines.map((l) => l.productId))];
    const priced = await tx
      .select({ id: products.id, name: products.name, salePriceCents: products.salePriceCents })
      .from(products)
      .where(and(eq(products.companyId, companyId), eq(products.active, true), inArray(products.id, productIds)));
    const byId = new Map(priced.map((p) => [p.id, p]));
    if (byId.size !== productIds.length) return err('VALIDATION', 'unknown product', { field: 'lines' });

    const subtotals: Cents[] = [];
    const lines = input.lines.map((line) => {
      const product = byId.get(line.productId);
      if (!product || product.salePriceCents <= BigInt(0)) {
        throw new Error('unpriced product passed the active filter');
      }
      const subtotal = lineSubtotal(product.salePriceCents, line.quantity);
      subtotals.push(subtotal);
      return {
        productId: product.id,
        name: product.name,
        unitPriceCents: product.salePriceCents.toString(),
        quantity: line.quantity,
        subtotalCents: subtotal.toString(),
      };
    });
    const total: Cents = sumCents(subtotals);

    const number = await nextNumber(anonymousCtx(tx, companyId, 'fr'), 'website.web_order', {
      prefix: 'WEB-{YYYY}-',
      padding: 5,
    });

    const [row] = await tx
      .insert(webOrders)
      .values({
        companyId,
        number,
        customerName: input.customerName,
        phone,
        wilayaCode: input.wilayaCode,
        address: input.address,
        lines,
        totalCents: total,
        state: 'new',
      })
      .returning({ id: webOrders.id });
    if (!row) return err('INTERNAL', 'insert failed');

    const [settings] = await tx
      .select({ auto: websiteSettings.autoCreateSaleOrder })
      .from(websiteSettings)
      .where(eq(websiteSettings.companyId, companyId))
      .limit(1);
    if (settings?.auto) await autoConvertWebOrder(tx, companyId, row.id);

    // Anonymous intake: audit with actor_type 'system' and no user.
    await tx.insert(auditLog).values({
      companyId,
      actorUserId: null,
      actorType: 'system',
      action: 'create',
      entity: 'website.web_order',
      recordId: row.id,
      changes: { after: { number, totalCents: total.toString() } },
    });

    return ok({ number, totalCents: total.toString() });
  });
}
