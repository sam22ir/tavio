CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"legal_name" text NOT NULL,
	"display_name" text NOT NULL,
	"nif" text,
	"nis" text,
	"rc" text,
	"ai" text,
	"address" text,
	"wilaya_code" text,
	"commune" text,
	"phone" text,
	"email" text,
	"logo_file_id" uuid,
	"default_locale" text DEFAULT 'fr' NOT NULL,
	"timezone" text DEFAULT 'Africa/Algiers' NOT NULL,
	"currency_code" text DEFAULT 'DZD' NOT NULL,
	"fiscal_year_start_month" smallint DEFAULT 1 NOT NULL,
	"plan" text DEFAULT 'saas_starter' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "companies_status_check" CHECK ("companies"."status" in ('active', 'suspended', 'closed')),
	CONSTRAINT "companies_default_locale_check" CHECK ("companies"."default_locale" in ('fr', 'ar', 'en')),
	CONSTRAINT "companies_fiscal_year_start_month_check" CHECK ("companies"."fiscal_year_start_month" between 1 and 12),
	CONSTRAINT "companies_plan_check" CHECK ("companies"."plan" in ('onprem', 'saas_starter', 'saas_pro'))
);
--> statement-breakpoint
CREATE TABLE "company_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"module_id" text NOT NULL,
	"version" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"enabled_at" timestamp with time zone,
	"disabled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"invited_email" text,
	"invite_token_hash" text,
	"invite_expires_at" timestamp with time zone,
	"joined_at" timestamp with time zone,
	"record_scope" text DEFAULT 'company' NOT NULL,
	CONSTRAINT "memberships_status_check" CHECK ("memberships"."status" in ('invited', 'active', 'suspended', 'left')),
	CONSTRAINT "memberships_record_scope_check" CHECK ("memberships"."record_scope" in ('company', 'own'))
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"permission" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_type" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"record_id" uuid,
	"changes" jsonb,
	"request_id" text,
	"ip" "inet",
	"user_agent" text,
	CONSTRAINT "audit_log_actor_type_check" CHECK ("audit_log"."actor_type" in ('user', 'system', 'job', 'api_key'))
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"bucket" text NOT NULL,
	"original_name" text,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" text NOT NULL,
	"kind" text NOT NULL,
	"entity" text,
	"record_id" uuid,
	"encrypted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "files_company_storage_key_unique" UNIQUE("company_id","storage_key"),
	CONSTRAINT "files_bucket_check" CHECK ("files"."bucket" in ('tavio-files', 'tavio-id-photos')),
	CONSTRAINT "files_kind_check" CHECK ("files"."kind" in ('id_photo', 'contract_pdf', 'receipt_pdf', 'attachment', 'logo', 'other'))
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"last_error" text,
	CONSTRAINT "outbox_status_check" CHECK ("outbox"."status" in ('pending', 'processing', 'done', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"prefix" text DEFAULT '' NOT NULL,
	"padding" smallint DEFAULT 5 NOT NULL,
	"next_number" bigint DEFAULT 1 NOT NULL,
	"reset_yearly" boolean DEFAULT false NOT NULL,
	"fiscal_year" smallint,
	CONSTRAINT "sequences_company_code_unique" UNIQUE("company_id","code")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_status_idx" ON "companies" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_nif_key" ON "companies" USING btree ("nif") WHERE "companies"."nif" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_rc_key" ON "companies" USING btree ("rc") WHERE "companies"."rc" is not null;--> statement-breakpoint
CREATE INDEX "company_modules_company_id_enabled_idx" ON "company_modules" USING btree ("company_id","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "company_modules_company_id_module_id_key" ON "company_modules" USING btree ("company_id","module_id");--> statement-breakpoint
CREATE INDEX "memberships_company_id_status_idx" ON "memberships" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memberships_company_id_role_id_idx" ON "memberships" USING btree ("company_id","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_company_id_user_id_key" ON "memberships" USING btree ("company_id","user_id");--> statement-breakpoint
CREATE INDEX "role_permissions_company_id_role_id_idx" ON "role_permissions" USING btree ("company_id","role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_role_id_permission_key" ON "role_permissions" USING btree ("role_id","permission");--> statement-breakpoint
CREATE INDEX "roles_company_id_idx" ON "roles" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_company_id_key_key" ON "roles" USING btree ("company_id","key");--> statement-breakpoint
CREATE INDEX "audit_log_company_entity_record_created_idx" ON "audit_log" USING btree ("company_id","entity","record_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_company_actor_created_idx" ON "audit_log" USING btree ("company_id","actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_company_created_idx" ON "audit_log" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "files_company_entity_record_idx" ON "files" USING btree ("company_id","entity","record_id");--> statement-breakpoint
CREATE INDEX "files_company_kind_idx" ON "files" USING btree ("company_id","kind");--> statement-breakpoint
CREATE INDEX "outbox_available_at_pending_idx" ON "outbox" USING btree ("available_at") WHERE "outbox"."status" in ('pending', 'failed');--> statement-breakpoint
CREATE INDEX "outbox_company_status_idx" ON "outbox" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "sequences_company_idx" ON "sequences" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_idx" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");