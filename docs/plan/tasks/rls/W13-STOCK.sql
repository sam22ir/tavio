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
