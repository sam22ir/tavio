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
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tavio_app;
--> statement-breakpoint
REVOKE ALL ON users, sessions, accounts, verifications FROM tavio_app;
--> statement-breakpoint
-- Invitations are managed only through the owner connection (token hashes must never be readable by tenant code).
REVOKE ALL ON invitations FROM tavio_app;
--> statement-breakpoint
INSERT INTO company_modules (company_id, module_id, version, enabled, enabled_at)
SELECT c.id, 'ai_features', '1.0.0', true, now() FROM companies c
ON CONFLICT DO NOTHING;
