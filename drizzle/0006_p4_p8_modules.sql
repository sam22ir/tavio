CREATE TABLE "gl_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"account_class" integer NOT NULL,
	"type" text NOT NULL,
	"reconcilable" boolean DEFAULT false NOT NULL,
	CONSTRAINT "accounts_class_check" CHECK ("gl_accounts"."account_class" between 1 and 7),
	CONSTRAINT "accounts_type_check" CHECK ("gl_accounts"."type" in ('asset', 'liability', 'equity', 'income', 'expense'))
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"number" text NOT NULL,
	"journal_id" uuid NOT NULL,
	"date" date NOT NULL,
	"ref" text,
	"source_entity" text,
	"source_id" uuid,
	"state" text DEFAULT 'posted' NOT NULL,
	"reversed_by_id" uuid,
	CONSTRAINT "journal_entries_state_check" CHECK ("journal_entries"."state" in ('draft', 'posted'))
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"partner_id" uuid,
	"label" text,
	"debit_cents" bigint DEFAULT 0 NOT NULL,
	"credit_cents" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "journal_lines_one_side_check" CHECK ("journal_lines"."debit_cents" >= 0 and "journal_lines"."credit_cents" >= 0 and (("journal_lines"."debit_cents" > 0) <> ("journal_lines"."credit_cents" > 0)))
);
--> statement-breakpoint
CREATE TABLE "journals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	CONSTRAINT "journals_type_check" CHECK ("journals"."type" in ('sale', 'purchase', 'cash', 'bank', 'general'))
);
--> statement-breakpoint
CREATE TABLE "automation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"trigger_event" text NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"action" text NOT NULL,
	"action_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "automation_rules_action_check" CHECK ("automation_rules"."action" in ('create_activity','post_note','webhook'))
);
--> statement-breakpoint
CREATE TABLE "helpdesk_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"number" text NOT NULL,
	"partner_id" uuid,
	"team_id" uuid,
	"assignee_id" uuid,
	"priority" text DEFAULT 'normal' NOT NULL,
	"stage" text DEFAULT 'new' NOT NULL,
	"channel" text NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	CONSTRAINT "tickets_priority_check" CHECK ("tickets"."priority" in ('low', 'normal', 'high', 'urgent')),
	CONSTRAINT "tickets_stage_check" CHECK ("tickets"."stage" in ('new', 'in_progress', 'waiting', 'solved', 'closed')),
	CONSTRAINT "tickets_channel_check" CHECK ("tickets"."channel" in ('whatsapp', 'phone', 'email', 'walk_in'))
);
--> statement-breakpoint
CREATE TABLE "attendances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"check_in" timestamp with time zone NOT NULL,
	"check_out" timestamp with time zone,
	CONSTRAINT "attendances_order_check" CHECK ("attendances"."check_out" is null or "attendances"."check_out" >= "attendances"."check_in")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"user_id" uuid,
	"partner_id" uuid,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"job_title" text,
	"department_id" uuid,
	"manager_id" uuid,
	"hire_date" date,
	"phone" text,
	"email" text,
	"nin" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"days" numeric(14, 3) NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"reason" text,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	CONSTRAINT "leave_requests_state_check" CHECK ("leave_requests"."state" in ('draft', 'submitted', 'approved', 'refused')),
	CONSTRAINT "leave_requests_dates_check" CHECK ("leave_requests"."to_date" >= "leave_requests"."from_date"),
	CONSTRAINT "leave_requests_days_check" CHECK ("leave_requests"."days" > 0)
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reorder_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"min_qty" numeric(14, 3) NOT NULL,
	"max_qty" numeric(14, 3),
	CONSTRAINT "reorder_rules_min_check" CHECK ("reorder_rules"."min_qty" >= 0),
	CONSTRAINT "reorder_rules_max_check" CHECK ("reorder_rules"."max_qty" is null or "reorder_rules"."max_qty" >= "reorder_rules"."min_qty")
);
--> statement-breakpoint
CREATE TABLE "stock_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"type" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "stock_locations_type_check" CHECK ("stock_locations"."type" in ('internal', 'customer', 'supplier', 'inventory_loss')),
	CONSTRAINT "stock_locations_internal_warehouse_check" CHECK ("stock_locations"."type" <> 'internal' or "stock_locations"."warehouse_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "stock_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"from_location_id" uuid NOT NULL,
	"to_location_id" uuid NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"source_entity" text,
	"source_id" uuid,
	"done_at" timestamp with time zone,
	CONSTRAINT "stock_moves_state_check" CHECK ("stock_moves"."state" in ('draft', 'done', 'cancelled')),
	CONSTRAINT "stock_moves_quantity_check" CHECK ("stock_moves"."quantity" > 0),
	CONSTRAINT "stock_moves_done_at_check" CHECK ("stock_moves"."state" <> 'done' or "stock_moves"."done_at" is not null),
	CONSTRAINT "stock_moves_locations_check" CHECK ("stock_moves"."from_location_id" <> "stock_moves"."to_location_id")
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"wilaya_code" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"sequence" integer DEFAULT 10 NOT NULL,
	"product_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"tax_id" uuid,
	"tax_rate" numeric(7, 4) DEFAULT '0' NOT NULL,
	"subtotal_cents" bigint NOT NULL,
	"tax_cents" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"method" text NOT NULL,
	"date" date NOT NULL,
	"reference" text,
	CONSTRAINT "invoice_payments_amount_check" CHECK ("invoice_payments"."amount_cents" > 0),
	CONSTRAINT "invoice_payments_method_check" CHECK ("invoice_payments"."method" in ('cash','ccp','transfer','cib','edahabia','cheque'))
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"type" text NOT NULL,
	"number" text,
	"partner_id" uuid NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"date" date NOT NULL,
	"due_date" date,
	"origin" text,
	"source_entity" text,
	"source_id" uuid,
	"refund_of_id" uuid,
	"untaxed_cents" bigint DEFAULT 0 NOT NULL,
	"tax_cents" bigint DEFAULT 0 NOT NULL,
	"stamp_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"paid_cents" bigint DEFAULT 0 NOT NULL,
	"payment_state" text DEFAULT 'not_paid' NOT NULL,
	CONSTRAINT "invoices_type_check" CHECK ("invoices"."type" in ('out_invoice','out_refund','in_invoice','in_refund')),
	CONSTRAINT "invoices_state_check" CHECK ("invoices"."state" in ('draft','posted','cancelled')),
	CONSTRAINT "invoices_payment_state_check" CHECK ("invoices"."payment_state" in ('not_paid','partial','paid')),
	CONSTRAINT "invoices_totals_check" CHECK ("invoices"."total_cents" >= 0 and "invoices"."paid_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "campaign_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "marketing_campaign_recipients_status_check" CHECK ("campaign_recipients"."status" in ('pending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"channel" text NOT NULL,
	"language" text DEFAULT 'fr' NOT NULL,
	"message_fr" text NOT NULL,
	"message_ar" text NOT NULL,
	"segment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "marketing_campaigns_channel_check" CHECK ("campaigns"."channel" in ('whatsapp', 'sms', 'email')),
	CONSTRAINT "marketing_campaigns_language_check" CHECK ("campaigns"."language" in ('fr', 'ar')),
	CONSTRAINT "marketing_campaigns_state_check" CHECK ("campaigns"."state" in ('draft', 'ready', 'sent'))
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"hash" text NOT NULL,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "custom_field_defs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"key" text NOT NULL,
	"label_fr" text NOT NULL,
	"label_ar" text NOT NULL,
	"label_en" text NOT NULL,
	"type" text NOT NULL,
	"options" jsonb,
	"required" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "custom_field_defs_type_check" CHECK ("custom_field_defs"."type" in ('text', 'number', 'date', 'boolean', 'select')),
	CONSTRAINT "custom_field_defs_key_check" CHECK ("custom_field_defs"."key" ~ '^[a-z][a-z0-9_]{0,39}$')
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"webhook_id" uuid NOT NULL,
	"outbox_id" uuid NOT NULL,
	"event_name" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	CONSTRAINT "webhook_deliveries_status_check" CHECK ("webhook_deliveries"."status" in ('pending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"url" text NOT NULL,
	"events" text[] DEFAULT '{}'::text[] NOT NULL,
	"secret" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pos_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"tax_rate" numeric(7, 4) NOT NULL,
	"subtotal_cents" bigint NOT NULL,
	"tax_cents" bigint NOT NULL,
	CONSTRAINT "pos_order_lines_quantity_check" CHECK ("pos_order_lines"."quantity" > 0),
	CONSTRAINT "pos_order_lines_amounts_check" CHECK ("pos_order_lines"."unit_price_cents" >= 0 and "pos_order_lines"."subtotal_cents" >= 0 and "pos_order_lines"."tax_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pos_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"number" text NOT NULL,
	"partner_id" uuid,
	"method" text NOT NULL,
	"untaxed_cents" bigint NOT NULL,
	"tax_cents" bigint NOT NULL,
	"total_cents" bigint NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_orders_method_check" CHECK ("pos_orders"."method" in ('cash', 'cib', 'edahabia')),
	CONSTRAINT "pos_orders_totals_check" CHECK ("pos_orders"."untaxed_cents" >= 0 and "pos_orders"."tax_cents" >= 0 and "pos_orders"."total_cents" = "pos_orders"."untaxed_cents" + "pos_orders"."tax_cents")
);
--> statement-breakpoint
CREATE TABLE "pos_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"opened_by" uuid NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"opening_cash_cents" bigint DEFAULT 0 NOT NULL,
	"closing_cash_cents" bigint,
	"state" text DEFAULT 'open' NOT NULL,
	CONSTRAINT "pos_sessions_state_check" CHECK ("pos_sessions"."state" in ('open', 'closed')),
	CONSTRAINT "pos_sessions_opening_cash_check" CHECK ("pos_sessions"."opening_cash_cents" >= 0),
	CONSTRAINT "pos_sessions_closing_cash_check" CHECK ("pos_sessions"."closing_cash_cents" is null or "pos_sessions"."closing_cash_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "project_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"name" text NOT NULL,
	"assignee_id" uuid,
	"priority" text DEFAULT 'normal' NOT NULL,
	"deadline" date,
	"description" text,
	CONSTRAINT "project_tasks_priority_check" CHECK ("project_tasks"."priority" in ('low', 'normal', 'high', 'urgent'))
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"partner_id" uuid,
	"manager_id" uuid,
	"state" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "projects_state_check" CHECK ("projects"."state" in ('active', 'done', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "timesheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"hours" numeric(7, 2) NOT NULL,
	"description" text,
	CONSTRAINT "timesheets_hours_check" CHECK ("timesheets"."hours" > 0 and "timesheets"."hours" <= 24)
);
--> statement-breakpoint
CREATE TABLE "purchase_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"sequence" integer DEFAULT 10 NOT NULL,
	"product_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"received_qty" numeric(14, 3) DEFAULT '0' NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"tax_id" uuid,
	"subtotal_cents" bigint DEFAULT 0 NOT NULL,
	"tax_cents" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "purchase_order_lines_quantity_check" CHECK ("purchase_order_lines"."quantity" > 0),
	CONSTRAINT "purchase_order_lines_received_check" CHECK ("purchase_order_lines"."received_qty" >= 0 and "purchase_order_lines"."received_qty" <= "purchase_order_lines"."quantity"),
	CONSTRAINT "purchase_order_lines_unit_price_check" CHECK ("purchase_order_lines"."unit_price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"number" text,
	"partner_id" uuid NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"order_date" date NOT NULL,
	"expected_date" date,
	"untaxed_cents" bigint DEFAULT 0 NOT NULL,
	"tax_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"billed" boolean DEFAULT false NOT NULL,
	"note" text,
	CONSTRAINT "purchase_orders_state_check" CHECK ("purchase_orders"."state" in ('draft', 'sent', 'confirmed', 'received', 'cancelled')),
	CONSTRAINT "purchase_orders_totals_check" CHECK ("purchase_orders"."untaxed_cents" >= 0 and "purchase_orders"."tax_cents" >= 0 and "purchase_orders"."total_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sale_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price_cents" bigint NOT NULL,
	"discount_rate" numeric(7, 4) DEFAULT '0' NOT NULL,
	"tax_id" uuid,
	"subtotal_cents" bigint NOT NULL,
	"tax_cents" bigint NOT NULL,
	CONSTRAINT "sale_order_lines_quantity_check" CHECK ("sale_order_lines"."quantity" > 0),
	CONSTRAINT "sale_order_lines_unit_price_check" CHECK ("sale_order_lines"."unit_price_cents" >= 0),
	CONSTRAINT "sale_order_lines_discount_check" CHECK ("sale_order_lines"."discount_rate" >= 0 and "sale_order_lines"."discount_rate" <= 100)
);
--> statement-breakpoint
CREATE TABLE "sale_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"number" text,
	"partner_id" uuid NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"order_date" text NOT NULL,
	"validity_date" text,
	"salesperson_id" uuid,
	"note" text,
	"untaxed_cents" bigint DEFAULT 0 NOT NULL,
	"tax_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"invoiced" boolean DEFAULT false NOT NULL,
	CONSTRAINT "sale_orders_state_check" CHECK ("sale_orders"."state" in ('draft', 'sent', 'confirmed', 'cancelled', 'done')),
	CONSTRAINT "sale_orders_totals_check" CHECK ("sale_orders"."untaxed_cents" >= 0 and "sale_orders"."tax_cents" >= 0 and "sale_orders"."total_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "company_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"state" text DEFAULT 'trial' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"payment_method" text,
	CONSTRAINT "company_subscriptions_state_check" CHECK ("company_subscriptions"."state" in ('trial','active','past_due','cancelled')),
	CONSTRAINT "company_subscriptions_payment_method_check" CHECK ("company_subscriptions"."payment_method" is null or "company_subscriptions"."payment_method" in ('ccp','transfer','cash')),
	CONSTRAINT "company_subscriptions_seats_check" CHECK ("company_subscriptions"."seats" >= 1)
);
--> statement-breakpoint
CREATE TABLE "saas_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"price_per_user_cents" bigint NOT NULL,
	"max_users" integer NOT NULL,
	"modules" text[] NOT NULL,
	CONSTRAINT "saas_plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "web_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"number" text NOT NULL,
	"customer_name" text NOT NULL,
	"phone" text NOT NULL,
	"wilaya_code" text NOT NULL,
	"address" text NOT NULL,
	"lines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_cents" bigint NOT NULL,
	"state" text DEFAULT 'new' NOT NULL,
	"sale_order_id" uuid,
	CONSTRAINT "web_orders_state_check" CHECK ("web_orders"."state" in ('new', 'confirmed', 'cancelled')),
	CONSTRAINT "web_orders_total_check" CHECK ("web_orders"."total_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "website_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"about" text,
	"phone_whatsapp" text,
	"show_prices" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gl_accounts" ADD CONSTRAINT "gl_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_journal_id_journals_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_gl_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."gl_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journals" ADD CONSTRAINT "journals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helpdesk_teams" ADD CONSTRAINT "helpdesk_teams_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_team_id_helpdesk_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."helpdesk_teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_employees_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_type_id_leave_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reorder_rules" ADD CONSTRAINT "reorder_rules_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_from_location_id_stock_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."stock_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_to_location_id_stock_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."stock_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_tax_id_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."taxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_defs" ADD CONSTRAINT "custom_field_defs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_order_lines" ADD CONSTRAINT "pos_order_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_order_lines" ADD CONSTRAINT "pos_order_lines_order_id_pos_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."pos_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_order_lines" ADD CONSTRAINT "pos_order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_session_id_pos_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."pos_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_stages" ADD CONSTRAINT "project_stages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_stage_id_project_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."project_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_task_id_project_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_order_id_purchase_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_tax_id_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."taxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_order_lines" ADD CONSTRAINT "sale_order_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_order_lines" ADD CONSTRAINT "sale_order_lines_order_id_sale_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sale_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_order_lines" ADD CONSTRAINT "sale_order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_order_lines" ADD CONSTRAINT "sale_order_lines_tax_id_taxes_id_fk" FOREIGN KEY ("tax_id") REFERENCES "public"."taxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_orders" ADD CONSTRAINT "sale_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_orders" ADD CONSTRAINT "sale_orders_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_subscriptions" ADD CONSTRAINT "company_subscriptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_subscriptions" ADD CONSTRAINT "company_subscriptions_plan_id_saas_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."saas_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "web_orders" ADD CONSTRAINT "web_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_settings" ADD CONSTRAINT "website_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_company_id_code_key" ON "gl_accounts" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "accounts_company_id_type_idx" ON "gl_accounts" USING btree ("company_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_company_id_journal_id_number_key" ON "journal_entries" USING btree ("company_id","journal_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_company_id_source_key" ON "journal_entries" USING btree ("company_id","source_entity","source_id") WHERE "journal_entries"."source_id" is not null;--> statement-breakpoint
CREATE INDEX "journal_entries_company_id_date_idx" ON "journal_entries" USING btree ("company_id","date");--> statement-breakpoint
CREATE INDEX "journal_lines_company_id_entry_id_idx" ON "journal_lines" USING btree ("company_id","entry_id");--> statement-breakpoint
CREATE INDEX "journal_lines_company_id_account_id_idx" ON "journal_lines" USING btree ("company_id","account_id");--> statement-breakpoint
CREATE INDEX "journal_lines_company_id_partner_id_idx" ON "journal_lines" USING btree ("company_id","partner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journals_company_id_code_key" ON "journals" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "automation_rules_company_id_trigger_idx" ON "automation_rules" USING btree ("company_id","trigger_event","active");--> statement-breakpoint
CREATE INDEX "helpdesk_teams_company_id_active_idx" ON "helpdesk_teams" USING btree ("company_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_company_id_number_key" ON "tickets" USING btree ("company_id","number");--> statement-breakpoint
CREATE INDEX "tickets_company_id_stage_idx" ON "tickets" USING btree ("company_id","stage");--> statement-breakpoint
CREATE INDEX "tickets_company_id_partner_id_idx" ON "tickets" USING btree ("company_id","partner_id");--> statement-breakpoint
CREATE INDEX "tickets_company_id_team_id_idx" ON "tickets" USING btree ("company_id","team_id");--> statement-breakpoint
CREATE INDEX "tickets_company_id_assignee_id_idx" ON "tickets" USING btree ("company_id","assignee_id");--> statement-breakpoint
CREATE INDEX "attendances_company_id_employee_id_check_in_idx" ON "attendances" USING btree ("company_id","employee_id","check_in");--> statement-breakpoint
CREATE UNIQUE INDEX "attendances_open_per_employee_key" ON "attendances" USING btree ("company_id","employee_id") WHERE "attendances"."check_out" is null;--> statement-breakpoint
CREATE INDEX "departments_company_id_name_idx" ON "departments" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "employees_company_id_active_idx" ON "employees" USING btree ("company_id","active");--> statement-breakpoint
CREATE INDEX "employees_company_id_department_id_idx" ON "employees" USING btree ("company_id","department_id");--> statement-breakpoint
CREATE INDEX "employees_company_id_manager_id_idx" ON "employees" USING btree ("company_id","manager_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_company_id_user_id_key" ON "employees" USING btree ("company_id","user_id") WHERE "employees"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "leave_requests_company_id_employee_id_idx" ON "leave_requests" USING btree ("company_id","employee_id");--> statement-breakpoint
CREATE INDEX "leave_requests_company_id_state_idx" ON "leave_requests" USING btree ("company_id","state");--> statement-breakpoint
CREATE INDEX "leave_types_company_id_name_idx" ON "leave_types" USING btree ("company_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "reorder_rules_company_id_product_id_warehouse_id_key" ON "reorder_rules" USING btree ("company_id","product_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_locations_company_id_type_idx" ON "stock_locations" USING btree ("company_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_locations_company_id_warehouse_id_type_key" ON "stock_locations" USING btree ("company_id","warehouse_id","type") WHERE "stock_locations"."warehouse_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_locations_company_id_type_global_key" ON "stock_locations" USING btree ("company_id","type") WHERE "stock_locations"."warehouse_id" is null;--> statement-breakpoint
CREATE INDEX "stock_moves_company_id_state_idx" ON "stock_moves" USING btree ("company_id","state");--> statement-breakpoint
CREATE INDEX "stock_moves_company_id_product_id_idx" ON "stock_moves" USING btree ("company_id","product_id");--> statement-breakpoint
CREATE INDEX "stock_moves_company_id_from_location_id_idx" ON "stock_moves" USING btree ("company_id","from_location_id");--> statement-breakpoint
CREATE INDEX "stock_moves_company_id_to_location_id_idx" ON "stock_moves" USING btree ("company_id","to_location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_moves_company_id_source_product_key" ON "stock_moves" USING btree ("company_id","source_entity","source_id","product_id") WHERE "stock_moves"."source_id" is not null and "stock_moves"."state" <> 'cancelled';--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_company_id_code_key" ON "warehouses" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "warehouses_company_id_active_idx" ON "warehouses" USING btree ("company_id","active");--> statement-breakpoint
CREATE INDEX "invoice_lines_company_id_invoice_id_idx" ON "invoice_lines" USING btree ("company_id","invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_payments_company_id_invoice_id_idx" ON "invoice_payments" USING btree ("company_id","invoice_id");--> statement-breakpoint
CREATE INDEX "invoices_company_id_type_state_idx" ON "invoices" USING btree ("company_id","type","state");--> statement-breakpoint
CREATE INDEX "invoices_company_id_partner_id_idx" ON "invoices" USING btree ("company_id","partner_id");--> statement-breakpoint
CREATE INDEX "marketing_campaign_recipients_company_id_campaign_id_idx" ON "campaign_recipients" USING btree ("company_id","campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_campaign_recipients_company_id_campaign_id_partner_id_key" ON "campaign_recipients" USING btree ("company_id","campaign_id","partner_id");--> statement-breakpoint
CREATE INDEX "marketing_campaigns_company_id_state_idx" ON "campaigns" USING btree ("company_id","state");--> statement-breakpoint
CREATE INDEX "api_keys_company_id_revoked_at_idx" ON "api_keys" USING btree ("company_id","revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_hash_key" ON "api_keys" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "api_keys_company_id_prefix_idx" ON "api_keys" USING btree ("company_id","prefix");--> statement-breakpoint
CREATE INDEX "custom_field_defs_company_id_entity_position_idx" ON "custom_field_defs" USING btree ("company_id","entity","position");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_field_defs_company_id_entity_key_key" ON "custom_field_defs" USING btree ("company_id","entity","key");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_company_id_webhook_id_idx" ON "webhook_deliveries" USING btree ("company_id","webhook_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_deliveries_webhook_id_outbox_id_key" ON "webhook_deliveries" USING btree ("webhook_id","outbox_id");--> statement-breakpoint
CREATE INDEX "webhooks_company_id_active_idx" ON "webhooks" USING btree ("company_id","active");--> statement-breakpoint
CREATE INDEX "pos_order_lines_company_id_order_id_idx" ON "pos_order_lines" USING btree ("company_id","order_id");--> statement-breakpoint
CREATE INDEX "pos_orders_company_id_session_id_idx" ON "pos_orders" USING btree ("company_id","session_id");--> statement-breakpoint
CREATE INDEX "pos_orders_company_id_paid_at_idx" ON "pos_orders" USING btree ("company_id","paid_at");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_orders_company_id_number_key" ON "pos_orders" USING btree ("company_id","number");--> statement-breakpoint
CREATE INDEX "pos_sessions_company_id_state_idx" ON "pos_sessions" USING btree ("company_id","state");--> statement-breakpoint
CREATE INDEX "pos_sessions_company_id_opened_at_idx" ON "pos_sessions" USING btree ("company_id","opened_at");--> statement-breakpoint
CREATE INDEX "project_stages_company_id_project_id_idx" ON "project_stages" USING btree ("company_id","project_id");--> statement-breakpoint
CREATE INDEX "project_tasks_company_id_project_id_idx" ON "project_tasks" USING btree ("company_id","project_id");--> statement-breakpoint
CREATE INDEX "project_tasks_company_id_stage_id_idx" ON "project_tasks" USING btree ("company_id","stage_id");--> statement-breakpoint
CREATE INDEX "project_tasks_company_id_assignee_id_idx" ON "project_tasks" USING btree ("company_id","assignee_id");--> statement-breakpoint
CREATE INDEX "projects_company_id_state_idx" ON "projects" USING btree ("company_id","state");--> statement-breakpoint
CREATE INDEX "projects_company_id_partner_id_idx" ON "projects" USING btree ("company_id","partner_id");--> statement-breakpoint
CREATE INDEX "timesheets_company_id_user_id_date_idx" ON "timesheets" USING btree ("company_id","user_id","date");--> statement-breakpoint
CREATE INDEX "timesheets_company_id_task_id_idx" ON "timesheets" USING btree ("company_id","task_id");--> statement-breakpoint
CREATE INDEX "purchase_order_lines_company_id_order_id_idx" ON "purchase_order_lines" USING btree ("company_id","order_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_company_id_state_idx" ON "purchase_orders" USING btree ("company_id","state");--> statement-breakpoint
CREATE INDEX "purchase_orders_company_id_partner_id_idx" ON "purchase_orders" USING btree ("company_id","partner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_orders_company_id_number_uq" ON "purchase_orders" USING btree ("company_id","number");--> statement-breakpoint
CREATE INDEX "sale_order_lines_company_id_order_id_idx" ON "sale_order_lines" USING btree ("company_id","order_id");--> statement-breakpoint
CREATE INDEX "sale_orders_company_id_state_idx" ON "sale_orders" USING btree ("company_id","state");--> statement-breakpoint
CREATE INDEX "sale_orders_company_id_partner_id_idx" ON "sale_orders" USING btree ("company_id","partner_id");--> statement-breakpoint
CREATE INDEX "sale_orders_company_id_order_date_idx" ON "sale_orders" USING btree ("company_id","order_date");--> statement-breakpoint
CREATE INDEX "sale_orders_company_id_number_idx" ON "sale_orders" USING btree ("company_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "company_subscriptions_company_id_key" ON "company_subscriptions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_subscriptions_plan_id_idx" ON "company_subscriptions" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "web_orders_company_id_number_key" ON "web_orders" USING btree ("company_id","number");--> statement-breakpoint
CREATE INDEX "web_orders_company_id_state_created_idx" ON "web_orders" USING btree ("company_id","state","created_at");--> statement-breakpoint
CREATE INDEX "web_orders_company_id_phone_created_idx" ON "web_orders" USING btree ("company_id","phone","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "website_settings_company_id_key" ON "website_settings" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "website_settings_slug_key" ON "website_settings" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "website_settings_company_id_enabled_idx" ON "website_settings" USING btree ("company_id","enabled");