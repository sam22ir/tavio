CREATE TABLE "sample_records" (
	"company_id" uuid NOT NULL,
	"table_name" text NOT NULL,
	"record_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sample_records_table_name_record_id_pk" PRIMARY KEY("table_name","record_id")
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "business_type" text;--> statement-breakpoint
CREATE INDEX "sample_records_company_id_idx" ON "sample_records" USING btree ("company_id");--> statement-breakpoint
-- Tenant isolation, same policy as 0007/0009. Grants: the app role needs DML on the new table.
ALTER TABLE "sample_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON "sample_records";--> statement-breakpoint
CREATE POLICY tenant_isolation ON "sample_records" FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "sample_records" TO tavio_app;
