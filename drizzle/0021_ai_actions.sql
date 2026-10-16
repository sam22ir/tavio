CREATE TABLE "ai_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"state" text DEFAULT 'proposed' NOT NULL,
	"result" jsonb,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "ai_actions_state_check" CHECK ("ai_actions"."state" in ('proposed', 'confirmed', 'rejected', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "ai_reminder_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"action_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_reminder_log_stage_check" CHECK ("ai_reminder_log"."stage" in ('polite', 'firm', 'final'))
);
--> statement-breakpoint
CREATE INDEX "ai_actions_company_state_created_idx" ON "ai_actions" USING btree ("company_id","state","created_at");--> statement-breakpoint
CREATE INDEX "ai_reminder_log_company_contract_created_idx" ON "ai_reminder_log" USING btree ("company_id","contract_id","created_at");--> statement-breakpoint
-- W18: RLS and grants for the AI action tables (same policy as 0020).--> statement-breakpoint
ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON ai_actions;--> statement-breakpoint
CREATE POLICY tenant_isolation ON ai_actions FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_actions TO tavio_app;--> statement-breakpoint
ALTER TABLE ai_reminder_log ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON ai_reminder_log;--> statement-breakpoint
CREATE POLICY tenant_isolation ON ai_reminder_log FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_reminder_log TO tavio_app;