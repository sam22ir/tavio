import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { companies } from '@/core/db/schema/tenancy';
import { partners } from '@/modules/contacts/schema';

// Common columns (DATA_MODEL.md 0.1). `created_by` references users.id (FK added by integrator).
const commonColumns = () => ({
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // FK → users.id (added by integrator)
  createdBy: uuid('created_by'),
});

// Support teams. Tenant table.
export const helpdeskTeams = pgTable(
  'helpdesk_teams',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
  },
  (t) => [index('helpdesk_teams_company_id_active_idx').on(t.companyId, t.active)],
);

// Support tickets. Tenant table. Stage moves follow the transition table in service/rules.ts.
export const tickets = pgTable(
  'tickets',
  {
    ...commonColumns(),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    // TK-{YYYY}-00001, from core/sequences
    number: text('number').notNull(),
    partnerId: uuid('partner_id').references(() => partners.id),
    teamId: uuid('team_id').references(() => helpdeskTeams.id),
    // FK → users.id (integrator)
    assigneeId: uuid('assignee_id'),
    priority: text('priority').notNull().default('normal'),
    stage: text('stage').notNull().default('new'),
    channel: text('channel').notNull(),
    subject: text('subject').notNull(),
    description: text('description'),
  },
  (t) => [
    uniqueIndex('tickets_company_id_number_key').on(t.companyId, t.number),
    index('tickets_company_id_stage_idx').on(t.companyId, t.stage),
    index('tickets_company_id_partner_id_idx').on(t.companyId, t.partnerId),
    index('tickets_company_id_team_id_idx').on(t.companyId, t.teamId),
    index('tickets_company_id_assignee_id_idx').on(t.companyId, t.assigneeId),
    check('tickets_priority_check', sql`${t.priority} in ('low', 'normal', 'high', 'urgent')`),
    check('tickets_stage_check', sql`${t.stage} in ('new', 'in_progress', 'waiting', 'solved', 'closed')`),
    check(
      'tickets_channel_check',
      sql`${t.channel} in ('whatsapp', 'phone', 'email', 'walk_in')`,
    ),
  ],
);

export type HelpdeskTeam = typeof helpdeskTeams.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
