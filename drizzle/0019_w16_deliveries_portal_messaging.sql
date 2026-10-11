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
CREATE TABLE "message_opt_outs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_opt_outs_channel_check" CHECK ("message_opt_outs"."channel" in ('email', 'whatsapp'))
);
--> statement-breakpoint
CREATE TABLE "message_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"reminders_enabled" boolean DEFAULT false NOT NULL,
	"before_days" smallint DEFAULT 3 NOT NULL,
	"overdue_days" jsonb DEFAULT '[1, 7]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_settings_before_days_check" CHECK ("message_settings"."before_days" between 0 and 30)
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"key" text NOT NULL,
	"locale" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	CONSTRAINT "message_templates_locale_check" CHECK ("message_templates"."locale" in ('fr', 'ar'))
);
--> statement-breakpoint
CREATE TABLE "outbound_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"company_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"to_address" text NOT NULL,
	"partner_id" uuid,
	"subject" text DEFAULT '' NOT NULL,
	"body_html" text DEFAULT '' NOT NULL,
	"body_text" text DEFAULT '' NOT NULL,
	"template_key" text,
	"related_entity" text,
	"related_id" uuid,
	"state" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"provider_id" text,
	"sent_at" timestamp with time zone,
	"wa_url" text,
	"override_opt_out" boolean DEFAULT false NOT NULL,
	"dedupe_key" text,
	CONSTRAINT "outbound_messages_channel_check" CHECK ("outbound_messages"."channel" in ('email', 'whatsapp')),
	CONSTRAINT "outbound_messages_state_check" CHECK ("outbound_messages"."state" in ('queued', 'sent', 'failed', 'manual'))
);
--> statement-breakpoint
DROP INDEX "deliveries_company_id_source_live_key";--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "origin_delivery_id" uuid;--> statement-breakpoint
ALTER TABLE "delivery_lines" ADD COLUMN "delivered_qty" numeric(14, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_lines" ADD COLUMN "sale_order_line_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "invoice_policy" text DEFAULT 'order' NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_order_lines" ADD COLUMN "delivered_qty" numeric(14, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_order_lines" ADD COLUMN "cancelled_qty" numeric(14, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_order_lines" ADD COLUMN "invoiced_qty" numeric(14, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "portal_access_tokens" ADD CONSTRAINT "portal_access_tokens_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_login_requests" ADD CONSTRAINT "portal_login_requests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_opt_outs" ADD CONSTRAINT "message_opt_outs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_settings" ADD CONSTRAINT "message_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "portal_access_tokens_company_id_token_hash_key" ON "portal_access_tokens" USING btree ("company_id","token_hash");--> statement-breakpoint
CREATE INDEX "portal_access_tokens_company_id_partner_id_idx" ON "portal_access_tokens" USING btree ("company_id","partner_id");--> statement-breakpoint
CREATE INDEX "portal_login_requests_company_id_key_hash_created_at_idx" ON "portal_login_requests" USING btree ("company_id","key_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "message_opt_outs_company_partner_channel_key" ON "message_opt_outs" USING btree ("company_id","partner_id","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "message_settings_company_id_key" ON "message_settings" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_templates_company_key_locale_key" ON "message_templates" USING btree ("company_id","key","locale");--> statement-breakpoint
CREATE INDEX "outbound_messages_company_state_idx" ON "outbound_messages" USING btree ("company_id","state");--> statement-breakpoint
CREATE INDEX "outbound_messages_company_related_idx" ON "outbound_messages" USING btree ("company_id","related_entity","related_id");--> statement-breakpoint
CREATE INDEX "outbound_messages_queued_available_idx" ON "outbound_messages" USING btree ("available_at") WHERE "outbound_messages"."state" = 'queued';--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_messages_company_dedupe_key_key" ON "outbound_messages" USING btree ("company_id","dedupe_key") WHERE "outbound_messages"."dedupe_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_company_id_source_open_key" ON "deliveries" USING btree ("company_id","source_entity","source_id") WHERE "deliveries"."source_id" is not null and "deliveries"."state" in ('draft', 'ready');--> statement-breakpoint
CREATE INDEX "delivery_lines_company_id_sale_line_idx" ON "delivery_lines" USING btree ("company_id","sale_order_line_id");--> statement-breakpoint
ALTER TABLE "delivery_lines" ADD CONSTRAINT "delivery_lines_delivered_check" CHECK ("delivery_lines"."delivered_qty" >= 0 and "delivery_lines"."delivered_qty" <= "delivery_lines"."quantity");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_invoice_policy_check" CHECK ("products"."invoice_policy" in ('order', 'delivery'));--> statement-breakpoint
ALTER TABLE "sale_order_lines" ADD CONSTRAINT "sale_order_lines_progress_check" CHECK ("sale_order_lines"."delivered_qty" >= 0 and "sale_order_lines"."cancelled_qty" >= 0 and "sale_order_lines"."invoiced_qty" >= 0);--> statement-breakpoint
-- W16: RLS and grants for the new tenant tables (same policy as 0016/0017).--> statement-breakpoint
ALTER TABLE portal_access_tokens ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON portal_access_tokens;--> statement-breakpoint
CREATE POLICY tenant_isolation ON portal_access_tokens FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON portal_access_tokens TO tavio_app;--> statement-breakpoint
ALTER TABLE portal_login_requests ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON portal_login_requests;--> statement-breakpoint
CREATE POLICY tenant_isolation ON portal_login_requests FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON portal_login_requests TO tavio_app;--> statement-breakpoint
ALTER TABLE outbound_messages ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON outbound_messages;--> statement-breakpoint
CREATE POLICY tenant_isolation ON outbound_messages FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON outbound_messages TO tavio_app;--> statement-breakpoint
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON message_templates;--> statement-breakpoint
CREATE POLICY tenant_isolation ON message_templates FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON message_templates TO tavio_app;--> statement-breakpoint
ALTER TABLE message_opt_outs ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON message_opt_outs;--> statement-breakpoint
CREATE POLICY tenant_isolation ON message_opt_outs FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON message_opt_outs TO tavio_app;--> statement-breakpoint
ALTER TABLE message_settings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON message_settings;--> statement-breakpoint
CREATE POLICY tenant_isolation ON message_settings FOR ALL
  USING (company_id = nullif(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = nullif(current_setting('app.company_id', true), '')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON message_settings TO tavio_app;--> statement-breakpoint
-- W16-C backfill for sale orders confirmed before delivery notes (from src/modules/sales/backfill-w16c.sql).
-- W16-C backfill for sale orders created before delivery notes existed.
-- Not a drizzle migration: paste into the migration that adds the W16-C columns, after they exist.
-- Idempotent: only lines still at delivered_qty = 0 and invoiced_qty = 0 are touched, and only on
-- confirmed or done orders with no live delivery. Re-running changes nothing.
-- Old draft stock moves are left alone.

-- 1. Delivered and invoiced quantities per order line.
--    delivered_qty: done stock moves from the order to a customer location, per product.
--    invoiced_qty:  quantities on posted invoices created from the order, per product.
--    Both are capped at the ordered quantity.
update sale_order_lines l
set
  delivered_qty = least(
    l.quantity,
    coalesce((
      select sum(m.quantity)
      from stock_moves m
      join stock_locations tl on tl.id = m.to_location_id and tl.company_id = m.company_id and tl.type = 'customer'
      where m.company_id = l.company_id
        and m.source_entity = 'sales.order'
        and m.source_id = l.order_id
        and m.product_id = l.product_id
        and m.state = 'done'
    ), 0)
  ),
  invoiced_qty = least(
    l.quantity,
    coalesce((
      select sum(il.quantity)
      from invoice_lines il
      join invoices i on i.id = il.invoice_id and i.company_id = il.company_id
      where il.company_id = l.company_id
        and i.source_entity = 'sales.order'
        and i.source_id = l.order_id
        and i.state = 'posted'
        and il.product_id = l.product_id
    ), 0)
  ),
  updated_at = now()
where l.product_id is not null
  and l.delivered_qty = 0
  and l.invoiced_qty = 0
  and exists (
    select 1 from sale_orders o
    where o.id = l.order_id
      and o.company_id = l.company_id
      and o.state in ('confirmed', 'done')
  )
  and not exists (
    select 1 from deliveries d
    where d.company_id = l.company_id
      and d.source_entity = 'sales.order'
      and d.source_id = l.order_id
      and d.state <> 'cancelled'
  );--> statement-breakpoint
-- 2. Invoice policy for existing stock-tracked goods: bill what was delivered.
update products
set invoice_policy = 'delivery', updated_at = now()
where kind = 'goods'
  and track_stock = true
  and invoice_policy <> 'delivery';
