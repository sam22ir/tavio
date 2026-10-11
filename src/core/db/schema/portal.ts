import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { companies } from './tenancy';

// Customer portal access (W16-E). Tenant tables. Only the SHA-256 of a token is stored.
// partner_id references partners(id) (module table, not imported here, so no FK).
// The token string itself carries the company id as a prefix, so a link can be resolved
// inside withTenant (RLS applies) without a cross-tenant lookup.

export const portalAccessTokens = pgTable(
  'portal_access_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    partnerId: uuid('partner_id').notNull(),
    // sha-256 hex of the full token
    tokenHash: text('token_hash').notNull(),
    // 'login' (single use, 30 min) or 'document' (30 days, reusable until expiry)
    purpose: text('purpose').notNull(),
    // 'invoicing.invoice' | 'credit_sales.contract' for document links, null for login links
    targetEntity: text('target_entity'),
    targetId: uuid('target_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    // references users.id (FK added by integrator)
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('portal_access_tokens_company_id_token_hash_key').on(t.companyId, t.tokenHash),
    index('portal_access_tokens_company_id_partner_id_idx').on(t.companyId, t.partnerId),
    check('portal_access_tokens_purpose_check', sql`${t.purpose} in ('login', 'document')`),
    check(
      'portal_access_tokens_target_entity_check',
      sql`${t.targetEntity} is null or ${t.targetEntity} in ('invoicing.invoice', 'credit_sales.contract')`,
    ),
    check(
      'portal_access_tokens_target_pair_check',
      sql`(${t.targetEntity} is null) = (${t.targetId} is null)`,
    ),
    check(
      'portal_access_tokens_login_target_check',
      sql`${t.purpose} <> 'login' or ${t.targetEntity} is null`,
    ),
  ],
);

// One row per login request attempt, keyed by a hash of the normalized identifier and of the client IP.
// Used only for rate limiting. Rows older than the window are ignored.
export const portalLoginRequests = pgTable(
  'portal_login_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    keyHash: text('key_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('portal_login_requests_company_id_key_hash_created_at_idx').on(t.companyId, t.keyHash, t.createdAt)],
);

export type PortalAccessToken = typeof portalAccessTokens.$inferSelect;
export type NewPortalAccessToken = typeof portalAccessTokens.$inferInsert;
