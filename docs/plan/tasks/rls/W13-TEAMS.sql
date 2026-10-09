-- W13-TEAMS: sales teams. The tables and the leads.team_id column come from schema.ts.
-- Both tables are new tenant tables, so they need RLS and grants of their own (0007 covered only the tables that existed then).
-- The tables start empty, so no backfill is needed for leads.team_id.
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
