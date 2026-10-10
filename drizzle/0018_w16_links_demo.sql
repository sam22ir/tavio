ALTER TABLE "leads" DROP CONSTRAINT "leads_source_check";--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "is_demo" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sale_orders" ADD COLUMN "lead_id" uuid;--> statement-breakpoint
ALTER TABLE "website_settings" ADD COLUMN "auto_create_sale_order" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "sale_orders_company_id_lead_id_idx" ON "sale_orders" USING btree ("company_id","lead_id");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_source_check" CHECK ("leads"."source" is null or "leads"."source" in ('walk_in', 'phone', 'facebook', 'instagram', 'whatsapp', 'referral', 'other', 'website'));