-- Tenant isolation for every table that has company_id and no RLS yet (all P4–P8 module tables).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name, col.is_nullable
    FROM pg_class c
    JOIN information_schema.columns col ON col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'company_id'
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('alter table %I enable row level security', r.table_name);
    EXECUTE format('drop policy if exists tenant_isolation on %I', r.table_name);
    EXECUTE format($p$create policy tenant_isolation on %I for all
      using (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
      with check (company_id = nullif(current_setting('app.company_id', true), '')::uuid)$p$, r.table_name);
  END LOOP;
END $$;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tavio_app;
--> statement-breakpoint
REVOKE ALL ON users, sessions, accounts, verifications FROM tavio_app;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON uoms, currencies, saas_plans FROM tavio_app;
--> statement-breakpoint
-- Lines of posted documents can never change (headers keep payment/reversal bookkeeping in the service layer).
CREATE OR REPLACE FUNCTION tavio_forbid_posted_lines() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_state text;
BEGIN
  EXECUTE format('select state from %I where id = $1', TG_ARGV[0]) INTO parent_state
    USING (CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END ->> TG_ARGV[1])::uuid;
  IF parent_state = 'posted' THEN
    RAISE EXCEPTION 'POSTED_IMMUTABLE';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS journal_lines_posted_guard ON journal_lines;
--> statement-breakpoint
CREATE TRIGGER journal_lines_posted_guard BEFORE UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION tavio_forbid_posted_lines('journal_entries', 'entry_id');
--> statement-breakpoint
DROP TRIGGER IF EXISTS invoice_lines_posted_guard ON invoice_lines;
--> statement-breakpoint
CREATE TRIGGER invoice_lines_posted_guard BEFORE UPDATE OR DELETE ON invoice_lines
  FOR EACH ROW EXECUTE FUNCTION tavio_forbid_posted_lines('invoices', 'invoice_id');
--> statement-breakpoint
-- Enable the new modules for existing companies.
INSERT INTO company_modules (company_id, module_id, version, enabled, enabled_at)
SELECT c.id, m.module_id, '1.0.0', true, now()
FROM companies c
CROSS JOIN (VALUES ('sales'),('invoicing'),('inventory'),('purchases'),('accounting'),('pos'),('hr'),('projects'),('helpdesk'),('website'),('marketing'),('platform'),('automation'),('subscriptions')) AS m(module_id)
ON CONFLICT DO NOTHING;
