CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"record_id" uuid NOT NULL,
	"activity_type_id" uuid NOT NULL,
	"assignee_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"note" text,
	"due_date" date NOT NULL,
	"done_at" timestamp with time zone,
	"done_by" uuid,
	"done_note" text
);
--> statement-breakpoint
CREATE TABLE "activity_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"entity" text,
	"default_days" integer DEFAULT 0 NOT NULL,
	"icon" text,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "activity_types_company_name_entity_key" UNIQUE NULLS NOT DISTINCT("company_id","name","entity")
);
--> statement-breakpoint
CREATE TABLE "followers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"record_id" uuid NOT NULL,
	"user_id" uuid,
	"partner_id" uuid,
	CONSTRAINT "followers_one_target_check" CHECK (("followers"."user_id" is null) <> ("followers"."partner_id" is null))
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"record_id" uuid NOT NULL,
	"type" text NOT NULL,
	"body" text,
	"tracking" jsonb,
	"is_internal" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp with time zone,
	CONSTRAINT "messages_type_check" CHECK ("messages"."type" in ('comment', 'note', 'system'))
);
--> statement-breakpoint
CREATE TABLE "partner_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"job_title" text,
	"phone" text,
	"email" text,
	"is_primary" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"is_customer" boolean DEFAULT false NOT NULL,
	"is_supplier" boolean DEFAULT false NOT NULL,
	"is_prospect" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"display_name" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"company_name" text,
	"nif" text,
	"nis" text,
	"rc" text,
	"ai" text,
	"national_id" text,
	"national_id_hash" text,
	"phone" text,
	"phone_alt" text,
	"email" text,
	"address" text,
	"wilaya_code" text,
	"commune" text,
	"employer" text,
	"monthly_income_cents" bigint,
	"salesperson_id" uuid,
	"notes" text,
	"custom" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "partners_kind_check" CHECK ("partners"."kind" in ('individual', 'company')),
	CONSTRAINT "partners_role_check" CHECK ("partners"."is_customer" or "partners"."is_supplier" or "partners"."is_prospect"),
	CONSTRAINT "partners_individual_names_check" CHECK ("partners"."kind" <> 'individual' or ("partners"."first_name" is not null and "partners"."last_name" is not null)),
	CONSTRAINT "partners_company_name_check" CHECK ("partners"."kind" <> 'company' or "partners"."company_name" is not null),
	CONSTRAINT "partners_monthly_income_check" CHECK ("partners"."monthly_income_cents" is null or "partners"."monthly_income_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "client_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"contract_id" uuid,
	"score" integer NOT NULL,
	"band" text NOT NULL,
	"method" text DEFAULT 'rules' NOT NULL,
	"inputs" jsonb NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	"accepted_by" uuid,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "credit_sales_client_scores_score_check" CHECK ("client_scores"."score" between 0 and 100),
	CONSTRAINT "credit_sales_client_scores_band_check" CHECK ("client_scores"."band" in ('A', 'B', 'C', 'D', 'E')),
	CONSTRAINT "credit_sales_client_scores_method_check" CHECK ("client_scores"."method" in ('rules', 'manual', 'ai_suggested'))
);
--> statement-breakpoint
CREATE TABLE "contract_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"uom_id" uuid,
	"unit_price_cents" bigint NOT NULL,
	"line_total_cents" bigint NOT NULL,
	"tax_id" uuid,
	"tax_cents" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "credit_sales_contract_lines_line_no_check" CHECK ("contract_lines"."line_no" >= 1),
	CONSTRAINT "credit_sales_contract_lines_quantity_check" CHECK ("contract_lines"."quantity" > 0),
	CONSTRAINT "credit_sales_contract_lines_unit_price_check" CHECK ("contract_lines"."unit_price_cents" >= 0),
	CONSTRAINT "credit_sales_contract_lines_line_total_check" CHECK ("contract_lines"."line_total_cents" >= 0),
	CONSTRAINT "credit_sales_contract_lines_tax_check" CHECK ("contract_lines"."tax_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"partner_id" uuid NOT NULL,
	"lead_id" uuid,
	"state" text DEFAULT 'draft' NOT NULL,
	"salesperson_id" uuid,
	"start_date" date NOT NULL,
	"frequency" text NOT NULL,
	"installments_count" integer NOT NULL,
	"cash_price_cents" bigint NOT NULL,
	"markup_rate" numeric(7, 4) DEFAULT '0' NOT NULL,
	"markup_cents" bigint NOT NULL,
	"total_cents" bigint NOT NULL,
	"down_payment_cents" bigint NOT NULL,
	"financed_cents" bigint NOT NULL,
	"down_payment_paid_cents" bigint DEFAULT 0 NOT NULL,
	"confirmed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"defaulted_at" timestamp with time zone,
	"notes" text,
	"pdf_file_id" uuid,
	CONSTRAINT "credit_sales_contracts_state_check" CHECK ("contracts"."state" in ('draft', 'active', 'completed', 'cancelled', 'defaulted')),
	CONSTRAINT "credit_sales_contracts_frequency_check" CHECK ("contracts"."frequency" in ('monthly', 'weekly')),
	CONSTRAINT "credit_sales_contracts_installments_count_check" CHECK ("contracts"."installments_count" > 0),
	CONSTRAINT "credit_sales_contracts_cash_price_check" CHECK ("contracts"."cash_price_cents" >= 0),
	CONSTRAINT "credit_sales_contracts_markup_rate_check" CHECK ("contracts"."markup_rate" >= 0),
	CONSTRAINT "credit_sales_contracts_markup_check" CHECK ("contracts"."markup_cents" >= 0),
	CONSTRAINT "credit_sales_contracts_down_payment_check" CHECK ("contracts"."down_payment_cents" >= 0),
	CONSTRAINT "credit_sales_contracts_down_payment_max_check" CHECK ("contracts"."down_payment_cents" <= "contracts"."total_cents"),
	CONSTRAINT "credit_sales_contracts_total_check" CHECK ("contracts"."total_cents" = "contracts"."cash_price_cents" + "contracts"."markup_cents"),
	CONSTRAINT "credit_sales_contracts_financed_check" CHECK ("contracts"."financed_cents" = "contracts"."total_cents" - "contracts"."down_payment_cents" and "contracts"."financed_cents" >= 0),
	CONSTRAINT "credit_sales_contracts_cancelled_at_check" CHECK ("contracts"."state" <> 'cancelled' or "contracts"."cancelled_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "guarantors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"relation" text,
	"consent_at" timestamp with time zone NOT NULL,
	"consent_text_version" text NOT NULL,
	"id_photo_file_id" uuid,
	"signed_file_id" uuid
);
--> statement-breakpoint
CREATE TABLE "installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"due_date" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"paid_cents" bigint DEFAULT 0 NOT NULL,
	"last_paid_at" timestamp with time zone,
	CONSTRAINT "credit_sales_installments_seq_check" CHECK ("installments"."seq" >= 1),
	CONSTRAINT "credit_sales_installments_amount_check" CHECK ("installments"."amount_cents" > 0),
	CONSTRAINT "credit_sales_installments_paid_check" CHECK ("installments"."paid_cents" >= 0 and "installments"."paid_cents" <= "installments"."amount_cents")
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"installment_id" uuid,
	"contract_id" uuid,
	"amount_cents" bigint NOT NULL,
	CONSTRAINT "credit_sales_payment_allocations_amount_check" CHECK ("payment_allocations"."amount_cents" > 0),
	CONSTRAINT "credit_sales_payment_allocations_target_check" CHECK (num_nonnulls("payment_allocations"."installment_id", "payment_allocations"."contract_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"partner_id" uuid NOT NULL,
	"state" text DEFAULT 'posted' NOT NULL,
	"method" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"received_by" uuid NOT NULL,
	"external_ref" text,
	"bank_name" text,
	"cheque_due_date" date,
	"reversal_of_id" uuid,
	"reversed_by_id" uuid,
	"note" text,
	CONSTRAINT "credit_sales_payments_method_check" CHECK ("payments"."method" in ('cash', 'ccp', 'transfer', 'cib', 'edahabia', 'cheque')),
	CONSTRAINT "credit_sales_payments_state_check" CHECK ("payments"."state" in ('posted', 'reversed')),
	CONSTRAINT "credit_sales_payments_amount_check" CHECK ("payments"."amount_cents" > 0),
	CONSTRAINT "credit_sales_payments_cheque_due_date_check" CHECK ("payments"."method" <> 'cheque' or "payments"."cheque_due_date" is not null)
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"number" text NOT NULL,
	"payment_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"state" text DEFAULT 'issued' NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"total_cents" bigint NOT NULL,
	"pdf_file_id" uuid,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	CONSTRAINT "credit_sales_receipts_state_check" CHECK ("receipts"."state" in ('issued', 'voided')),
	CONSTRAINT "credit_sales_receipts_total_check" CHECK ("receipts"."total_cents" > 0),
	CONSTRAINT "credit_sales_receipts_void_check" CHECK ("receipts"."state" <> 'voided' or ("receipts"."voided_at" is not null and "receipts"."void_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"reference" text,
	"type" text DEFAULT 'lead' NOT NULL,
	"name" text NOT NULL,
	"partner_id" uuid,
	"contact_name" text,
	"phone" text,
	"email" text,
	"wilaya_code" text,
	"source" text,
	"pipeline_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"probability" integer NOT NULL,
	"expected_revenue_cents" bigint,
	"expected_close_date" date,
	"salesperson_id" uuid,
	"priority" smallint DEFAULT 0 NOT NULL,
	"lost_reason_id" uuid,
	"lost_at" timestamp with time zone,
	"won_at" timestamp with time zone,
	"converted_contract_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"next_activity_id" uuid,
	CONSTRAINT "leads_type_check" CHECK ("leads"."type" in ('lead', 'opportunity')),
	CONSTRAINT "leads_status_check" CHECK ("leads"."status" in ('open', 'won', 'lost')),
	CONSTRAINT "leads_source_check" CHECK ("leads"."source" is null or "leads"."source" in ('walk_in', 'phone', 'facebook', 'instagram', 'whatsapp', 'referral', 'other')),
	CONSTRAINT "leads_probability_check" CHECK ("leads"."probability" between 0 and 100),
	CONSTRAINT "leads_expected_revenue_check" CHECK ("leads"."expected_revenue_cents" is null or "leads"."expected_revenue_cents" >= 0),
	CONSTRAINT "leads_priority_check" CHECK ("leads"."priority" in (0, 1)),
	CONSTRAINT "leads_lost_check" CHECK ("leads"."status" <> 'lost' or ("leads"."lost_reason_id" is not null and "leads"."lost_at" is not null)),
	CONSTRAINT "leads_won_check" CHECK ("leads"."status" <> 'won' or "leads"."won_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "lost_reasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"team_user_ids" uuid[]
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"probability" integer NOT NULL,
	"is_won" boolean DEFAULT false NOT NULL,
	"fold" boolean DEFAULT false NOT NULL,
	CONSTRAINT "stages_probability_check" CHECK ("stages"."probability" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "tag_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"record_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	CONSTRAINT "tags_color_check" CHECK ("tags"."color" is null or "tags"."color" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"code" char(3) NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"decimals" smallint NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"rate" numeric(7, 4) NOT NULL,
	"scope" text NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"active" boolean DEFAULT true NOT NULL,
	"legal_ref" text,
	"is_default_sale" boolean DEFAULT false NOT NULL,
	"is_default_purchase" boolean DEFAULT false NOT NULL,
	CONSTRAINT "taxes_valid_to_check" CHECK ("taxes"."valid_to" is null or "taxes"."valid_to" >= "taxes"."valid_from"),
	CONSTRAINT "taxes_rate_check" CHECK ("taxes"."rate" >= 0),
	CONSTRAINT "taxes_kind_check" CHECK ("taxes"."kind" in ('vat', 'stamp', 'other')),
	CONSTRAINT "taxes_scope_check" CHECK ("taxes"."scope" in ('sale', 'purchase', 'both'))
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"code" text
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"sku" text,
	"name" text NOT NULL,
	"name_ar" text,
	"category_id" uuid,
	"kind" text NOT NULL,
	"uom_id" uuid NOT NULL,
	"sale_price_cents" bigint NOT NULL,
	"cost_cents" bigint NOT NULL,
	"default_tax_id" uuid,
	"track_stock" boolean DEFAULT false NOT NULL,
	"barcode" text,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "products_kind_check" CHECK ("products"."kind" in ('goods', 'service')),
	CONSTRAINT "products_sale_price_cents_check" CHECK ("products"."sale_price_cents" >= 0),
	CONSTRAINT "products_cost_cents_check" CHECK ("products"."cost_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "uoms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"name_fr" text NOT NULL,
	"name_ar" text,
	"name_en" text,
	"category" text NOT NULL,
	"factor_to_ref" numeric(20, 10) NOT NULL,
	"is_reference" boolean NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "uoms_category_check" CHECK ("uoms"."category" in ('unit', 'weight', 'length', 'area', 'volume', 'time'))
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_activity_type_id_activity_types_id_fk" FOREIGN KEY ("activity_type_id") REFERENCES "public"."activity_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_types" ADD CONSTRAINT "activity_types_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "followers" ADD CONSTRAINT "followers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_contacts" ADD CONSTRAINT "partner_contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_contacts" ADD CONSTRAINT "partner_contacts_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_scores" ADD CONSTRAINT "client_scores_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_scores" ADD CONSTRAINT "client_scores_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_lines" ADD CONSTRAINT "contract_lines_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantors" ADD CONSTRAINT "guarantors_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantors" ADD CONSTRAINT "guarantors_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reversal_of_id_payments_id_fk" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reversed_by_id_payments_id_fk" FOREIGN KEY ("reversed_by_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_lost_reason_id_lost_reasons_id_fk" FOREIGN KEY ("lost_reason_id") REFERENCES "public"."lost_reasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lost_reasons" ADD CONSTRAINT "lost_reasons_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_links" ADD CONSTRAINT "tag_links_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag_links" ADD CONSTRAINT "tag_links_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxes" ADD CONSTRAINT "taxes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_product_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_uom_id_uoms_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."uoms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_open_assignee_due_idx" ON "activities" USING btree ("company_id","assignee_id","due_date") WHERE "activities"."done_at" is null;--> statement-breakpoint
CREATE INDEX "activities_company_entity_record_idx" ON "activities" USING btree ("company_id","entity","record_id");--> statement-breakpoint
CREATE INDEX "activity_types_company_entity_idx" ON "activity_types" USING btree ("company_id","entity");--> statement-breakpoint
CREATE INDEX "followers_company_entity_record_idx" ON "followers" USING btree ("company_id","entity","record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "followers_company_entity_record_user_key" ON "followers" USING btree ("company_id","entity","record_id","user_id") WHERE "followers"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "followers_company_entity_record_partner_key" ON "followers" USING btree ("company_id","entity","record_id","partner_id") WHERE "followers"."partner_id" is not null;--> statement-breakpoint
CREATE INDEX "messages_company_entity_record_idx" ON "messages" USING btree ("company_id","entity","record_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "partner_contacts_company_id_partner_id_idx" ON "partner_contacts" USING btree ("company_id","partner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_contacts_partner_id_primary_key" ON "partner_contacts" USING btree ("partner_id") WHERE "partner_contacts"."is_primary";--> statement-breakpoint
CREATE INDEX "partners_company_id_active_idx" ON "partners" USING btree ("company_id","active");--> statement-breakpoint
CREATE INDEX "partners_company_id_display_name_idx" ON "partners" USING btree ("company_id","display_name");--> statement-breakpoint
CREATE INDEX "partners_company_id_phone_idx" ON "partners" USING btree ("company_id","phone");--> statement-breakpoint
CREATE INDEX "partners_company_id_is_customer_idx" ON "partners" USING btree ("company_id","is_customer") WHERE "partners"."is_customer";--> statement-breakpoint
CREATE INDEX "partners_company_id_salesperson_id_idx" ON "partners" USING btree ("company_id","salesperson_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partners_company_id_nif_key" ON "partners" USING btree ("company_id","nif") WHERE "partners"."nif" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "partners_company_id_rc_key" ON "partners" USING btree ("company_id","rc") WHERE "partners"."rc" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "partners_company_id_nis_key" ON "partners" USING btree ("company_id","nis") WHERE "partners"."nis" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "partners_company_id_national_id_hash_key" ON "partners" USING btree ("company_id","national_id_hash") WHERE "partners"."national_id_hash" is not null;--> statement-breakpoint
CREATE INDEX "credit_sales_client_scores_company_partner_computed_idx" ON "client_scores" USING btree ("company_id","partner_id","computed_at" desc);--> statement-breakpoint
CREATE INDEX "credit_sales_client_scores_company_band_idx" ON "client_scores" USING btree ("company_id","band");--> statement-breakpoint
CREATE INDEX "credit_sales_contract_lines_company_product_idx" ON "contract_lines" USING btree ("company_id","product_id");--> statement-breakpoint
CREATE INDEX "credit_sales_contract_lines_contract_idx" ON "contract_lines" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_sales_contract_lines_contract_line_no_key" ON "contract_lines" USING btree ("contract_id","line_no");--> statement-breakpoint
CREATE INDEX "credit_sales_contracts_company_state_idx" ON "contracts" USING btree ("company_id","state");--> statement-breakpoint
CREATE INDEX "credit_sales_contracts_company_partner_idx" ON "contracts" USING btree ("company_id","partner_id");--> statement-breakpoint
CREATE INDEX "credit_sales_contracts_company_start_idx" ON "contracts" USING btree ("company_id","start_date");--> statement-breakpoint
CREATE INDEX "credit_sales_contracts_company_salesperson_idx" ON "contracts" USING btree ("company_id","salesperson_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_sales_contracts_company_reference_key" ON "contracts" USING btree ("company_id","reference");--> statement-breakpoint
CREATE INDEX "credit_sales_guarantors_company_contract_idx" ON "guarantors" USING btree ("company_id","contract_id");--> statement-breakpoint
CREATE INDEX "credit_sales_guarantors_company_partner_idx" ON "guarantors" USING btree ("company_id","partner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_sales_guarantors_contract_partner_key" ON "guarantors" USING btree ("contract_id","partner_id");--> statement-breakpoint
CREATE INDEX "credit_sales_installments_company_due_idx" ON "installments" USING btree ("company_id","due_date") WHERE "installments"."paid_cents" < "installments"."amount_cents";--> statement-breakpoint
CREATE INDEX "credit_sales_installments_company_contract_idx" ON "installments" USING btree ("company_id","contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_sales_installments_contract_seq_key" ON "installments" USING btree ("contract_id","seq");--> statement-breakpoint
CREATE INDEX "credit_sales_payment_allocations_company_payment_idx" ON "payment_allocations" USING btree ("company_id","payment_id");--> statement-breakpoint
CREATE INDEX "credit_sales_payment_allocations_company_installment_idx" ON "payment_allocations" USING btree ("company_id","installment_id");--> statement-breakpoint
CREATE INDEX "credit_sales_payment_allocations_company_contract_idx" ON "payment_allocations" USING btree ("company_id","contract_id");--> statement-breakpoint
CREATE INDEX "credit_sales_payments_company_partner_received_idx" ON "payments" USING btree ("company_id","partner_id","received_at");--> statement-breakpoint
CREATE INDEX "credit_sales_payments_company_method_received_idx" ON "payments" USING btree ("company_id","method","received_at");--> statement-breakpoint
CREATE INDEX "credit_sales_payments_company_state_idx" ON "payments" USING btree ("company_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_sales_payments_company_reference_key" ON "payments" USING btree ("company_id","reference");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_sales_payments_company_method_external_ref_key" ON "payments" USING btree ("company_id","method","external_ref") WHERE "payments"."external_ref" is not null and "payments"."state" = 'posted';--> statement-breakpoint
CREATE INDEX "credit_sales_receipts_company_issued_idx" ON "receipts" USING btree ("company_id","issued_at");--> statement-breakpoint
CREATE INDEX "credit_sales_receipts_company_partner_idx" ON "receipts" USING btree ("company_id","partner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_sales_receipts_company_number_key" ON "receipts" USING btree ("company_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_sales_receipts_payment_id_key" ON "receipts" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "leads_company_id_pipeline_id_stage_id_idx" ON "leads" USING btree ("company_id","pipeline_id","stage_id");--> statement-breakpoint
CREATE INDEX "leads_company_id_status_idx" ON "leads" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "leads_company_id_salesperson_id_status_idx" ON "leads" USING btree ("company_id","salesperson_id","status");--> statement-breakpoint
CREATE INDEX "leads_company_id_partner_id_idx" ON "leads" USING btree ("company_id","partner_id");--> statement-breakpoint
CREATE INDEX "leads_company_id_phone_idx" ON "leads" USING btree ("company_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_company_id_reference_key" ON "leads" USING btree ("company_id","reference") WHERE "leads"."reference" is not null;--> statement-breakpoint
CREATE INDEX "lost_reasons_company_id_active_idx" ON "lost_reasons" USING btree ("company_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "lost_reasons_company_id_name_key" ON "lost_reasons" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "pipelines_company_id_active_idx" ON "pipelines" USING btree ("company_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "pipelines_company_id_name_key" ON "pipelines" USING btree ("company_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "pipelines_company_id_default_key" ON "pipelines" USING btree ("company_id") WHERE "pipelines"."is_default";--> statement-breakpoint
CREATE INDEX "stages_company_id_pipeline_id_position_idx" ON "stages" USING btree ("company_id","pipeline_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "stages_pipeline_id_position_key" ON "stages" USING btree ("pipeline_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "stages_pipeline_id_name_key" ON "stages" USING btree ("pipeline_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "stages_pipeline_id_is_won_key" ON "stages" USING btree ("pipeline_id") WHERE "stages"."is_won";--> statement-breakpoint
CREATE INDEX "tag_links_company_id_entity_record_id_idx" ON "tag_links" USING btree ("company_id","entity","record_id");--> statement-breakpoint
CREATE INDEX "tag_links_company_id_tag_id_idx" ON "tag_links" USING btree ("company_id","tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_links_tag_id_entity_record_id_key" ON "tag_links" USING btree ("tag_id","entity","record_id");--> statement-breakpoint
CREATE INDEX "tags_company_id_idx" ON "tags" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_company_id_name_key" ON "tags" USING btree ("company_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies" USING btree ("code");--> statement-breakpoint
CREATE INDEX "taxes_company_id_code_valid_from_idx" ON "taxes" USING btree ("company_id","code","valid_from");--> statement-breakpoint
CREATE INDEX "taxes_company_id_scope_active_idx" ON "taxes" USING btree ("company_id","scope","active");--> statement-breakpoint
CREATE UNIQUE INDEX "taxes_company_id_code_valid_from_key" ON "taxes" USING btree ("company_id","code","valid_from");--> statement-breakpoint
CREATE INDEX "product_categories_company_id_parent_id_idx" ON "product_categories" USING btree ("company_id","parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_company_id_name_key" ON "product_categories" USING btree ("company_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_company_id_code_key" ON "product_categories" USING btree ("company_id","code") WHERE "product_categories"."code" is not null;--> statement-breakpoint
CREATE INDEX "products_company_id_category_id_idx" ON "products" USING btree ("company_id","category_id");--> statement-breakpoint
CREATE INDEX "products_company_id_name_idx" ON "products" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "products_company_id_active_idx" ON "products" USING btree ("company_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "products_company_id_sku_key" ON "products" USING btree ("company_id","sku") WHERE "products"."sku" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "products_company_id_barcode_key" ON "products" USING btree ("company_id","barcode") WHERE "products"."barcode" is not null;--> statement-breakpoint
CREATE INDEX "uoms_category_idx" ON "uoms" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "uoms_code_key" ON "uoms" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "uoms_category_reference_key" ON "uoms" USING btree ("category") WHERE "uoms"."is_reference";