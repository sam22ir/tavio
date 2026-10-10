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
