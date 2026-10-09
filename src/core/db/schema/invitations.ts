import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { companies } from './tenancy';

// Team invitations (W6-B). Tenant table. Only the SHA-256 of the token is stored.
export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // lowercased
    email: text('email').notNull(),
    // owner, admin, manager or staff
    roleKey: text('role_key').notNull(),
    // sha-256 hex of the token shown once
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    // references users.id (FK added by integrator)
    invitedBy: uuid('invited_by').notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    // references users.id (FK added by integrator)
    acceptedBy: uuid('accepted_by'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('invitations_company_id_idx').on(t.companyId),
    uniqueIndex('invitations_token_hash_key').on(t.tokenHash),
    uniqueIndex('invitations_company_id_email_open_key')
      .on(t.companyId, t.email)
      .where(sql`${t.acceptedAt} is null and ${t.revokedAt} is null`),
  ],
);

export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
