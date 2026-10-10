-- W13-CRM: lead stage timestamp, attempt counter and channel.
-- The columns and checks come from schema.ts. stage_entered_at defaults to now(), so existing leads
-- are backfilled here with their creation time, which is the first stage they were in.
UPDATE leads SET stage_entered_at = created_at WHERE stage_entered_at IS DISTINCT FROM created_at;

--> statement-breakpoint
-- W13-ACT: RLS for the activity plan tables, grants, and the delay backfill.
-- New tenant tables: activity_plans, activity_plan_steps, activity_plan_runs.
-- The earlier ALL TABLES grant in 0009 does not cover tables created later, so grant them explicitly.
ALTER TABLE activity_plans ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON activity_plans;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON activity_plans FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE activity_plan_steps ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON activity_plan_steps;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON activity_plan_steps FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE activity_plan_runs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON activity_plan_runs;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON activity_plan_runs FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON activity_plans, activity_plan_steps, activity_plan_runs TO tavio_app;
--> statement-breakpoint
-- Backfill: the new delay replaces default_days (days unit, same count).
UPDATE activity_types SET delay_count = default_days, delay_unit = 'days' WHERE delay_count = 0 AND default_days > 0;

--> statement-breakpoint
-- W13-CREDIT: tenant isolation for the two new credit_sales tables.
-- Same policy style as drizzle/0007_p4_p8_rls.sql. The integrator turns this into a migration.
-- The contracts state check is widened in schema.ts; the generated migration drops and recreates
-- credit_sales_contracts_state_check. New contract columns are nullable, so no backfill is needed.
ALTER TABLE credit_document_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON credit_document_requirements;
CREATE POLICY tenant_isolation ON credit_document_requirements FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE credit_contract_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON credit_contract_documents;
CREATE POLICY tenant_isolation ON credit_contract_documents FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);

--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON credit_document_requirements, credit_contract_documents TO tavio_app;
--> statement-breakpoint
-- W13-PO: RLS for purchase_product_suppliers (tenant table). Same style as drizzle/0007_p4_p8_rls.sql.
-- New columns purchase_orders.source_entity / source_id are nullable with no backfill.
ALTER TABLE purchase_product_suppliers ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON purchase_product_suppliers;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON purchase_product_suppliers FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_product_suppliers TO tavio_app;

--> statement-breakpoint
-- W13-STOCK: tenant isolation for stock_reservations, deliveries, delivery_lines.
-- Same policy style as drizzle/0007_p4_p8_rls.sql. The integrator turns this into a migration.
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON stock_reservations;
CREATE POLICY tenant_isolation ON stock_reservations FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON deliveries;
CREATE POLICY tenant_isolation ON deliveries FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE delivery_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON delivery_lines;
CREATE POLICY tenant_isolation ON delivery_lines FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON stock_reservations, deliveries, delivery_lines TO tavio_app;

--> statement-breakpoint
-- W13-TEAMS: sales teams. The tables and the leads.team_id column come from schema.ts.
-- Both tables are new tenant tables, so they need RLS and grants of their own (0007 covered only the tables that existed then).
-- The tables start empty, so no backfill is needed for leads.team_id.
-- The new crm_settings table has no row until a company saves the setting; no row means visibility is not restricted.
ALTER TABLE sales_teams ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON sales_teams;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON sales_teams FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE sales_team_members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON sales_team_members;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON sales_team_members FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON sales_teams, sales_team_members TO tavio_app;
--> statement-breakpoint
-- crm_settings: one row per company with the lead visibility switch (default off).
ALTER TABLE crm_settings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON crm_settings;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON crm_settings FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON crm_settings TO tavio_app;
--> statement-breakpoint
-- Backfill: leads without a team take the team of their salesperson, when that salesperson is a member.
UPDATE leads l
SET team_id = m.team_id
FROM sales_team_members m
WHERE l.team_id IS NULL
  AND m.company_id = l.company_id
  AND m.user_id = l.salesperson_id;

--> statement-breakpoint
-- W13-AUTO: rule run dedupe for time-based automation rules.
-- The new columns on automation_rules (kind, time_config, nullable trigger_event) and the widened
-- checks come from schema.ts. Only the new tenant table needs hand SQL here.
ALTER TABLE automation_rule_runs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON automation_rule_runs;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON automation_rule_runs FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON automation_rule_runs TO tavio_app;

--> statement-breakpoint
-- User-id foreign keys for the new columns (same users.id target as the existing FKs in 0000 and DATA_MODEL.md).
-- All of these columns are new in 0011 and empty, so the constraints add without a data check.
ALTER TABLE activity_types ADD CONSTRAINT activity_types_default_user_id_users_id_fk FOREIGN KEY (default_user_id) REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE activity_plan_steps ADD CONSTRAINT activity_plan_steps_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE activity_plan_runs ADD CONSTRAINT activity_plan_runs_owner_id_users_id_fk FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE sales_teams ADD CONSTRAINT sales_teams_leader_id_users_id_fk FOREIGN KEY (leader_id) REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE sales_team_members ADD CONSTRAINT sales_team_members_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE contracts ADD CONSTRAINT contracts_bo_owner_id_users_id_fk FOREIGN KEY (bo_owner_id) REFERENCES users(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE contracts ADD CONSTRAINT contracts_decided_by_users_id_fk FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL;
