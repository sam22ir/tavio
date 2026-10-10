CREATE TABLE "bank_statement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"statement_id" uuid NOT NULL,
	"date" date NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"reference" text,
	"amount_cents" bigint NOT NULL,
	"partner_id" uuid,
	"state" text DEFAULT 'unmatched' NOT NULL,
	CONSTRAINT "bank_statement_lines_state_check" CHECK ("bank_statement_lines"."state" in ('unmatched', 'matched', 'ignored'))
);
--> statement-breakpoint
CREATE TABLE "bank_statement_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"statement_line_id" uuid NOT NULL,
	"journal_line_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"opening_balance_cents" bigint NOT NULL,
	"closing_balance_cents" bigint NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "bank_statements_state_check" CHECK ("bank_statements"."state" in ('open', 'done')),
	CONSTRAINT "bank_statements_range_check" CHECK ("bank_statements"."date_to" >= "bank_statements"."date_from")
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "withholding_tax_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "withholding_rate" numeric(7, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "withholding_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_statement_id_bank_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."bank_statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_matches" ADD CONSTRAINT "bank_statement_matches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_matches" ADD CONSTRAINT "bank_statement_matches_statement_line_id_bank_statement_lines_id_fk" FOREIGN KEY ("statement_line_id") REFERENCES "public"."bank_statement_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statement_matches" ADD CONSTRAINT "bank_statement_matches_journal_line_id_journal_lines_id_fk" FOREIGN KEY ("journal_line_id") REFERENCES "public"."journal_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_account_id_gl_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_statement_lines_company_id_statement_id_idx" ON "bank_statement_lines" USING btree ("company_id","statement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_statement_matches_company_id_journal_line_id_key" ON "bank_statement_matches" USING btree ("company_id","journal_line_id");--> statement-breakpoint
CREATE INDEX "bank_statement_matches_company_id_statement_line_id_idx" ON "bank_statement_matches" USING btree ("company_id","statement_line_id");--> statement-breakpoint
CREATE INDEX "bank_statements_company_id_account_id_idx" ON "bank_statements" USING btree ("company_id","account_id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_withholding_tax_id_taxes_id_fk" FOREIGN KEY ("withholding_tax_id") REFERENCES "public"."taxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_withholding_check" CHECK ("invoices"."withholding_cents" >= 0);--> statement-breakpoint
-- W15-E: RLS and grants for the reconciliation tables (same policy as 0016).
ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON bank_statements;--> statement-breakpoint
CREATE POLICY tenant_isolation ON bank_statements FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON bank_statements TO tavio_app;--> statement-breakpoint
ALTER TABLE bank_statement_lines ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON bank_statement_lines;--> statement-breakpoint
CREATE POLICY tenant_isolation ON bank_statement_lines FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON bank_statement_lines TO tavio_app;--> statement-breakpoint
ALTER TABLE bank_statement_matches ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON bank_statement_matches;--> statement-breakpoint
CREATE POLICY tenant_isolation ON bank_statement_matches FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON bank_statement_matches TO tavio_app;
