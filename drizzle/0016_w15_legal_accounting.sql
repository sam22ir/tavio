CREATE TABLE "accounting_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"lock_date" date
);
--> statement-breakpoint
CREATE TABLE "fiscal_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "fiscal_years_state_check" CHECK ("fiscal_years"."state" in ('open', 'closed')),
	CONSTRAINT "fiscal_years_range_check" CHECK ("fiscal_years"."end_date" >= "fiscal_years"."start_date")
);
--> statement-breakpoint
CREATE TABLE "contract_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"clauses_fr" text,
	"clauses_ar" text,
	"city" text,
	"late_penalty_rate" numeric(7, 4),
	"guarantor_required_above_cents" bigint,
	CONSTRAINT "credit_sales_contract_settings_penalty_check" CHECK ("contract_settings"."late_penalty_rate" is null or "contract_settings"."late_penalty_rate" >= 0),
	CONSTRAINT "credit_sales_contract_settings_guarantor_check" CHECK ("contract_settings"."guarantor_required_above_cents" is null or "contract_settings"."guarantor_required_above_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "g50_declarations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"year" smallint NOT NULL,
	"month" smallint NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"figures" jsonb NOT NULL,
	"validated_by" uuid,
	"validated_at" timestamp with time zone,
	CONSTRAINT "g50_declarations_month_check" CHECK ("g50_declarations"."month" between 1 and 12),
	CONSTRAINT "g50_declarations_state_check" CHECK ("g50_declarations"."state" in ('draft', 'validated')),
	CONSTRAINT "g50_declarations_validated_check" CHECK ("g50_declarations"."state" = 'draft' or "g50_declarations"."validated_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "l10n_dz_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"tax_regime" text DEFAULT 'reel' NOT NULL,
	"stamp_methods" text[] DEFAULT '{cash}' NOT NULL,
	CONSTRAINT "l10n_dz_settings_tax_regime_check" CHECK ("l10n_dz_settings"."tax_regime" in ('reel', 'ifu'))
);
--> statement-breakpoint
CREATE TABLE "l10n_dz_stamp_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"sort_order" smallint NOT NULL,
	"up_to_da" bigint,
	"mode" text NOT NULL,
	"fixed_cents" bigint DEFAULT 0 NOT NULL,
	"rate_percent" numeric(7, 4) DEFAULT '0' NOT NULL,
	CONSTRAINT "l10n_dz_stamp_tiers_mode_check" CHECK ("l10n_dz_stamp_tiers"."mode" in ('fixed', 'rate')),
	CONSTRAINT "l10n_dz_stamp_tiers_fixed_check" CHECK ("l10n_dz_stamp_tiers"."fixed_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "journals" DROP CONSTRAINT "journals_type_check";--> statement-breakpoint
ALTER TABLE "taxes" DROP CONSTRAINT "taxes_kind_check";--> statement-breakpoint
DROP INDEX "credit_sales_guarantors_contract_partner_key";--> statement-breakpoint
ALTER TABLE "guarantors" ALTER COLUMN "partner_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "guarantors" ALTER COLUMN "consent_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "guarantors" ALTER COLUMN "consent_text_version" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "rib" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "ccp" text;--> statement-breakpoint
ALTER TABLE "gl_accounts" ADD COLUMN "parent_code" text;--> statement-breakpoint
ALTER TABLE "gl_accounts" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "guarantors" ADD COLUMN "full_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "guarantors" ADD COLUMN "nin" text NOT NULL;--> statement-breakpoint
ALTER TABLE "guarantors" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "guarantors" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "taxes" ADD COLUMN "sale_account_code" text DEFAULT '447' NOT NULL;--> statement-breakpoint
ALTER TABLE "taxes" ADD COLUMN "purchase_account_code" text DEFAULT '447' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounting_settings" ADD CONSTRAINT "accounting_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_settings" ADD CONSTRAINT "contract_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "g50_declarations" ADD CONSTRAINT "g50_declarations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "l10n_dz_settings" ADD CONSTRAINT "l10n_dz_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "l10n_dz_stamp_tiers" ADD CONSTRAINT "l10n_dz_stamp_tiers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_settings_company_id_key" ON "accounting_settings" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fiscal_years_company_id_start_date_key" ON "fiscal_years" USING btree ("company_id","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_sales_contract_settings_company_key" ON "contract_settings" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "g50_declarations_company_id_year_month_key" ON "g50_declarations" USING btree ("company_id","year","month");--> statement-breakpoint
CREATE UNIQUE INDEX "l10n_dz_settings_company_id_key" ON "l10n_dz_settings" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "l10n_dz_stamp_tiers_company_id_sort_order_key" ON "l10n_dz_stamp_tiers" USING btree ("company_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_sales_guarantors_contract_partner_key" ON "guarantors" USING btree ("contract_id","partner_id") WHERE "guarantors"."partner_id" is not null;--> statement-breakpoint
ALTER TABLE "journals" ADD CONSTRAINT "journals_type_check" CHECK ("journals"."type" in ('sale', 'purchase', 'cash', 'bank', 'misc', 'general'));--> statement-breakpoint
ALTER TABLE "guarantors" ADD CONSTRAINT "credit_sales_guarantors_nin_check" CHECK (length("guarantors"."nin") between 3 and 40);--> statement-breakpoint
-- W15-C: tax kinds renamed (vat -> tva); TVA posts to 4457 (sales) / 4456 (purchases). To verify with the accountant.
UPDATE "taxes" SET "kind" = 'tva' WHERE "kind" = 'vat';--> statement-breakpoint
UPDATE "taxes" SET "sale_account_code" = '4457', "purchase_account_code" = '4456' WHERE "kind" = 'tva';--> statement-breakpoint
ALTER TABLE "taxes" ADD CONSTRAINT "taxes_kind_check" CHECK ("taxes"."kind" in ('tva', 'tap', 'retenue_source', 'other'));--> statement-breakpoint
-- W15: RLS and grants for the new tenant tables (same policy as 0007/0009/0012).
ALTER TABLE accounting_settings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON accounting_settings;--> statement-breakpoint
CREATE POLICY tenant_isolation ON accounting_settings FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON accounting_settings TO tavio_app;--> statement-breakpoint
ALTER TABLE fiscal_years ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON fiscal_years;--> statement-breakpoint
CREATE POLICY tenant_isolation ON fiscal_years FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON fiscal_years TO tavio_app;--> statement-breakpoint
ALTER TABLE contract_settings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON contract_settings;--> statement-breakpoint
CREATE POLICY tenant_isolation ON contract_settings FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON contract_settings TO tavio_app;--> statement-breakpoint
ALTER TABLE g50_declarations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON g50_declarations;--> statement-breakpoint
CREATE POLICY tenant_isolation ON g50_declarations FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON g50_declarations TO tavio_app;--> statement-breakpoint
ALTER TABLE l10n_dz_settings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON l10n_dz_settings;--> statement-breakpoint
CREATE POLICY tenant_isolation ON l10n_dz_settings FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON l10n_dz_settings TO tavio_app;--> statement-breakpoint
ALTER TABLE l10n_dz_stamp_tiers ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON l10n_dz_stamp_tiers;--> statement-breakpoint
CREATE POLICY tenant_isolation ON l10n_dz_stamp_tiers FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON l10n_dz_stamp_tiers TO tavio_app;
