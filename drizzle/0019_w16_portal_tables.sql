CREATE TABLE "portal_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"purpose" text NOT NULL,
	"target_entity" text,
	"target_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_access_tokens_purpose_check" CHECK ("portal_access_tokens"."purpose" in ('login', 'document')),
	CONSTRAINT "portal_access_tokens_target_entity_check" CHECK ("portal_access_tokens"."target_entity" is null or "portal_access_tokens"."target_entity" in ('invoicing.invoice', 'credit_sales.contract')),
	CONSTRAINT "portal_access_tokens_target_pair_check" CHECK (("portal_access_tokens"."target_entity" is null) = ("portal_access_tokens"."target_id" is null)),
	CONSTRAINT "portal_access_tokens_login_target_check" CHECK ("portal_access_tokens"."purpose" <> 'login' or "portal_access_tokens"."target_entity" is null)
);
--> statement-breakpoint
CREATE TABLE "portal_login_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portal_access_tokens" ADD CONSTRAINT "portal_access_tokens_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_login_requests" ADD CONSTRAINT "portal_login_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "portal_access_tokens_company_id_token_hash_key" ON "portal_access_tokens" USING btree ("company_id","token_hash");--> statement-breakpoint
CREATE INDEX "portal_access_tokens_company_id_partner_id_idx" ON "portal_access_tokens" USING btree ("company_id","partner_id");--> statement-breakpoint
CREATE INDEX "portal_login_requests_company_id_key_hash_created_at_idx" ON "portal_login_requests" USING btree ("company_id","key_hash","created_at");;--> statement-breakpoint
-- Tenant isolation for the portal tables (same policy as the module tables in 0003).
ALTER TABLE "portal_access_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "portal_access_tokens" FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "portal_login_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "portal_login_requests" FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);
