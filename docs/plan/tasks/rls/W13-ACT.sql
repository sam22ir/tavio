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
