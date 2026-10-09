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
