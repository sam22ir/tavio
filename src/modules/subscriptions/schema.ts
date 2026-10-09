import { sql } from 'drizzle-orm';
import { bigint, check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { companies } from '@/core/db/schema/tenancy';

// Global table (no company_id): the SaaS plan catalogue. Written by the owner connection only.
export const saasPlans = pgTable('saas_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  pricePerUserCents: bigint('price_per_user_cents', { mode: 'bigint' }).notNull(),
  maxUsers: integer('max_users').notNull(),
  // Module ids enabled by this plan, e.g. 'invoicing'
  modules: text('modules').array().notNull(),
});

// Tenant table: each company's current subscription.
export const companySubscriptions = pgTable(
  'company_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    // FK → users.id (added by integrator)
    createdBy: uuid('created_by'),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // FK → saas_plans.id (same module, safe to reference)
    planId: uuid('plan_id')
      .notNull()
      .references(() => saasPlans.id),
    seats: integer('seats').notNull().default(1),
    state: text('state').notNull().default('trial'),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    paymentMethod: text('payment_method'),
  },
  (t) => [
    check('company_subscriptions_state_check', sql`${t.state} in ('trial','active','past_due','cancelled')`),
    check(
      'company_subscriptions_payment_method_check',
      sql`${t.paymentMethod} is null or ${t.paymentMethod} in ('ccp','transfer','cash')`,
    ),
    check('company_subscriptions_seats_check', sql`${t.seats} >= 1`),
    uniqueIndex('company_subscriptions_company_id_key').on(t.companyId),
    index('company_subscriptions_plan_id_idx').on(t.planId),
  ],
);

export type SaasPlanRow = typeof saasPlans.$inferSelect;
export type CompanySubscription = typeof companySubscriptions.$inferSelect;
