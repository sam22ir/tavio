CREATE TABLE "debit_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"number" text NOT NULL,
	"period_month" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"exported_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "credit_sales_debit_batches_status_check" CHECK ("debit_batches"."status" in ('draft', 'exported', 'closed', 'cancelled')),
	CONSTRAINT "credit_sales_debit_batches_total_check" CHECK ("debit_batches"."total_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "debit_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"installment_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"ccp_account" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"payment_id" uuid,
	"settled_on" date,
	CONSTRAINT "credit_sales_debit_items_status_check" CHECK ("debit_items"."status" in ('pending', 'paid', 'rejected', 'needs_review', 'cancelled')),
	CONSTRAINT "credit_sales_debit_items_amount_check" CHECK ("debit_items"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "debit_mandates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"ccp_account" text NOT NULL,
	"signed_on" date NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "credit_sales_debit_mandates_account_check" CHECK ("debit_mandates"."ccp_account" ~ '^[0-9]{10,20}$')
);
--> statement-breakpoint
ALTER TABLE "debit_batches" ADD CONSTRAINT "debit_batches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_items" ADD CONSTRAINT "debit_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_items" ADD CONSTRAINT "debit_items_batch_id_debit_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."debit_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_items" ADD CONSTRAINT "debit_items_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_items" ADD CONSTRAINT "debit_items_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_items" ADD CONSTRAINT "debit_items_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_mandates" ADD CONSTRAINT "debit_mandates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_mandates" ADD CONSTRAINT "debit_mandates_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_sales_debit_batches_company_number_key" ON "debit_batches" USING btree ("company_id","number");--> statement-breakpoint
CREATE INDEX "credit_sales_debit_batches_company_status_idx" ON "debit_batches" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_sales_debit_items_company_reference_key" ON "debit_items" USING btree ("company_id","reference");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_sales_debit_items_installment_open_key" ON "debit_items" USING btree ("installment_id") WHERE "debit_items"."status" in ('pending', 'needs_review');--> statement-breakpoint
CREATE INDEX "credit_sales_debit_items_company_batch_idx" ON "debit_items" USING btree ("company_id","batch_id");--> statement-breakpoint
CREATE INDEX "credit_sales_debit_items_company_contract_idx" ON "debit_items" USING btree ("company_id","contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_sales_debit_mandates_contract_key" ON "debit_mandates" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "credit_sales_debit_mandates_company_partner_idx" ON "debit_mandates" USING btree ("company_id","partner_id");--> statement-breakpoint
-- W17: RLS and grants for the CCP direct-debit tables (same policy as 0016/0017/0019).--> statement-breakpoint
ALTER TABLE debit_mandates ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON debit_mandates;--> statement-breakpoint
CREATE POLICY tenant_isolation ON debit_mandates FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON debit_mandates TO tavio_app;--> statement-breakpoint
ALTER TABLE debit_batches ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON debit_batches;--> statement-breakpoint
CREATE POLICY tenant_isolation ON debit_batches FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON debit_batches TO tavio_app;--> statement-breakpoint
ALTER TABLE debit_items ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON debit_items;--> statement-breakpoint
CREATE POLICY tenant_isolation ON debit_items FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON debit_items TO tavio_app;
