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
