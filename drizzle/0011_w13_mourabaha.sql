CREATE TABLE "automation_rule_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"record_id" uuid NOT NULL,
	"status" text DEFAULT 'done' NOT NULL,
	"fired_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automation_rule_runs_status_check" CHECK ("automation_rule_runs"."status" in ('done','skipped'))
);
--> statement-breakpoint
CREATE TABLE "activity_plan_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"record_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"owner_id" uuid,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "activity_plan_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"activity_type_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"offset_days" integer DEFAULT 0 NOT NULL,
	"responsible" text DEFAULT 'record_owner' NOT NULL,
	"user_id" uuid,
	CONSTRAINT "activity_plan_steps_responsible_check" CHECK ("activity_plan_steps"."responsible" in ('record_owner', 'fixed')),
	CONSTRAINT "activity_plan_steps_responsible_user_check" CHECK (("activity_plan_steps"."responsible" = 'fixed') = ("activity_plan_steps"."user_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "activity_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"entity" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_contract_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"requirement_id" uuid NOT NULL,
	"file_id" uuid,
	"status" text DEFAULT 'missing' NOT NULL,
	"note" text,
	CONSTRAINT "credit_contract_documents_status_check" CHECK ("credit_contract_documents"."status" in ('missing', 'received', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "credit_document_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"restrict_lead_visibility" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"leader_id" uuid
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"number" text NOT NULL,
	"partner_id" uuid NOT NULL,
	"source_entity" text,
	"source_id" uuid,
	"state" text DEFAULT 'draft' NOT NULL,
	"scheduled_date" date,
	"delivered_at" timestamp with time zone,
	"signed_by_name" text,
	"signature_file_id" uuid,
	"proof_file_id" uuid,
	"note" text,
	CONSTRAINT "deliveries_state_check" CHECK ("deliveries"."state" in ('draft', 'ready', 'done', 'cancelled')),
	CONSTRAINT "deliveries_done_at_check" CHECK ("deliveries"."state" <> 'done' or "deliveries"."delivered_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "delivery_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"delivery_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	CONSTRAINT "delivery_lines_quantity_check" CHECK ("delivery_lines"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "stock_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"source_entity" text NOT NULL,
	"source_id" uuid NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "stock_reservations_state_check" CHECK ("stock_reservations"."state" in ('active', 'released', 'consumed')),
	CONSTRAINT "stock_reservations_quantity_check" CHECK ("stock_reservations"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_product_suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"sequence" integer DEFAULT 10 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "automation_rules" DROP CONSTRAINT "automation_rules_action_check";--> statement-breakpoint
ALTER TABLE "contracts" DROP CONSTRAINT "credit_sales_contracts_state_check";--> statement-breakpoint
ALTER TABLE "automation_rules" ALTER COLUMN "trigger_event" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD COLUMN "kind" text DEFAULT 'event' NOT NULL;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD COLUMN "time_config" jsonb;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "result" text;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "plan_run_id" uuid;--> statement-breakpoint
ALTER TABLE "activity_types" ADD COLUMN "delay_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_types" ADD COLUMN "delay_unit" text DEFAULT 'days' NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_types" ADD COLUMN "category" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_types" ADD COLUMN "chaining_type" text DEFAULT 'suggest' NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_types" ADD COLUMN "next_type_id" uuid;--> statement-breakpoint
ALTER TABLE "activity_types" ADD COLUMN "default_user_id" uuid;--> statement-breakpoint
ALTER TABLE "activity_types" ADD COLUMN "require_result" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "bo_owner_id" uuid;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "sent_to_bo_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "received_by_bo_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "decision_reason" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "next_action" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "decided_by" uuid;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "central_risk_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "central_risk_result" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "bank_name" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "bank_reference" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "bank_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "stage_entered_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "channel" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "stages" ADD COLUMN "requirements" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "source_entity" text;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "automation_rule_runs" ADD CONSTRAINT "automation_rule_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rule_runs" ADD CONSTRAINT "automation_rule_runs_rule_id_automation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_plan_runs" ADD CONSTRAINT "activity_plan_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_plan_runs" ADD CONSTRAINT "activity_plan_runs_plan_id_activity_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."activity_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_plan_steps" ADD CONSTRAINT "activity_plan_steps_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_plan_steps" ADD CONSTRAINT "activity_plan_steps_plan_id_activity_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."activity_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_plan_steps" ADD CONSTRAINT "activity_plan_steps_activity_type_id_activity_types_id_fk" FOREIGN KEY ("activity_type_id") REFERENCES "public"."activity_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_plans" ADD CONSTRAINT "activity_plans_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_contract_documents" ADD CONSTRAINT "credit_contract_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_contract_documents" ADD CONSTRAINT "credit_contract_documents_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_contract_documents" ADD CONSTRAINT "credit_contract_documents_requirement_id_credit_document_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."credit_document_requirements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_document_requirements" ADD CONSTRAINT "credit_document_requirements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_settings" ADD CONSTRAINT "crm_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_team_members" ADD CONSTRAINT "sales_team_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_team_members" ADD CONSTRAINT "sales_team_members_team_id_sales_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."sales_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_teams" ADD CONSTRAINT "sales_teams_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_lines" ADD CONSTRAINT "delivery_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_lines" ADD CONSTRAINT "delivery_lines_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_lines" ADD CONSTRAINT "delivery_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_location_id_stock_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."stock_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_product_suppliers" ADD CONSTRAINT "purchase_product_suppliers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_product_suppliers" ADD CONSTRAINT "purchase_product_suppliers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_product_suppliers" ADD CONSTRAINT "purchase_product_suppliers_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "automation_rule_runs_company_rule_record_uq" ON "automation_rule_runs" USING btree ("company_id","rule_id","record_id");--> statement-breakpoint
CREATE INDEX "activity_plan_runs_company_entity_record_idx" ON "activity_plan_runs" USING btree ("company_id","entity","record_id");--> statement-breakpoint
CREATE INDEX "activity_plan_steps_company_plan_idx" ON "activity_plan_steps" USING btree ("company_id","plan_id","sequence");--> statement-breakpoint
CREATE INDEX "activity_plans_company_entity_idx" ON "activity_plans" USING btree ("company_id","entity");--> statement-breakpoint
CREATE INDEX "credit_contract_documents_company_contract_idx" ON "credit_contract_documents" USING btree ("company_id","contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_contract_documents_contract_requirement_key" ON "credit_contract_documents" USING btree ("contract_id","requirement_id");--> statement-breakpoint
CREATE INDEX "credit_document_requirements_company_active_idx" ON "credit_document_requirements" USING btree ("company_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_document_requirements_company_name_key" ON "credit_document_requirements" USING btree ("company_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_settings_company_id_key" ON "crm_settings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sales_team_members_company_id_team_id_idx" ON "sales_team_members" USING btree ("company_id","team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_team_members_company_id_user_id_key" ON "sales_team_members" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE INDEX "sales_teams_company_id_idx" ON "sales_teams" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_teams_company_id_name_key" ON "sales_teams" USING btree ("company_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_company_id_number_key" ON "deliveries" USING btree ("company_id","number");--> statement-breakpoint
CREATE INDEX "deliveries_company_id_state_idx" ON "deliveries" USING btree ("company_id","state");--> statement-breakpoint
CREATE INDEX "deliveries_company_id_source_idx" ON "deliveries" USING btree ("company_id","source_entity","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_company_id_source_live_key" ON "deliveries" USING btree ("company_id","source_entity","source_id") WHERE "deliveries"."source_id" is not null and "deliveries"."state" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "delivery_lines_company_id_delivery_id_idx" ON "delivery_lines" USING btree ("company_id","delivery_id");--> statement-breakpoint
CREATE INDEX "stock_reservations_company_id_state_product_idx" ON "stock_reservations" USING btree ("company_id","state","product_id");--> statement-breakpoint
CREATE INDEX "stock_reservations_company_id_source_idx" ON "stock_reservations" USING btree ("company_id","source_entity","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_reservations_company_id_source_product_active_key" ON "stock_reservations" USING btree ("company_id","source_entity","source_id","product_id") WHERE "stock_reservations"."state" = 'active';--> statement-breakpoint
CREATE INDEX "purchase_product_suppliers_company_id_product_id_idx" ON "purchase_product_suppliers" USING btree ("company_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_product_suppliers_company_product_partner_uq" ON "purchase_product_suppliers" USING btree ("company_id","product_id","partner_id");--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_plan_run_id_activity_plan_runs_id_fk" FOREIGN KEY ("plan_run_id") REFERENCES "public"."activity_plan_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_types" ADD CONSTRAINT "activity_types_next_type_id_activity_types_id_fk" FOREIGN KEY ("next_type_id") REFERENCES "public"."activity_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_team_id_sales_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."sales_teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_company_plan_run_idx" ON "activities" USING btree ("company_id","plan_run_id");--> statement-breakpoint
CREATE INDEX "leads_company_id_team_id_idx" ON "leads" USING btree ("company_id","team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_company_id_source_partner_uq" ON "purchase_orders" USING btree ("company_id","source_entity","source_id","partner_id") WHERE "purchase_orders"."source_id" is not null;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_kind_check" CHECK ("automation_rules"."kind" in ('event','time'));--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_action_check" CHECK ("automation_rules"."action" in ('create_activity','post_note','webhook','update_record','launch_activity_plan','cancel_activity_plans','multi'));--> statement-breakpoint
ALTER TABLE "activity_types" ADD CONSTRAINT "activity_types_delay_unit_check" CHECK ("activity_types"."delay_unit" in ('days', 'weeks'));--> statement-breakpoint
ALTER TABLE "activity_types" ADD CONSTRAINT "activity_types_category_check" CHECK ("activity_types"."category" in ('default', 'phonecall', 'upload_file', 'meeting'));--> statement-breakpoint
ALTER TABLE "activity_types" ADD CONSTRAINT "activity_types_chaining_check" CHECK ("activity_types"."chaining_type" in ('suggest', 'trigger'));--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "credit_sales_contracts_refused_reason_check" CHECK ("contracts"."state" <> 'refused' or "contracts"."decision_reason" is not null);--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "credit_sales_contracts_central_risk_result_check" CHECK ("contracts"."central_risk_result" is null or "contracts"."central_risk_result" in ('clear', 'flagged'));--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "credit_sales_contracts_state_check" CHECK ("contracts"."state" in ('draft', 'submitted', 'under_review', 'approved', 'refused', 'reserved', 'active', 'completed', 'cancelled', 'defaulted'));--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_attempt_count_check" CHECK ("leads"."attempt_count" >= 0);--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_channel_check" CHECK ("leads"."channel" is null or "leads"."channel" in ('phone', 'whatsapp', 'showroom', 'web', 'referral', 'other'));