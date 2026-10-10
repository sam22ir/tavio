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
