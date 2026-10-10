ALTER TABLE "purchase_order_lines" ADD COLUMN "billed_qty" numeric(14, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_billed_check" CHECK ("purchase_order_lines"."billed_qty" >= 0 and "purchase_order_lines"."billed_qty" <= "purchase_order_lines"."received_qty");--> statement-breakpoint
-- Backfill: orders billed before this change were billed for everything received at that time.
UPDATE "purchase_order_lines" AS l SET "billed_qty" = l."received_qty" FROM "purchase_orders" AS o WHERE o."id" = l."order_id" AND o."billed" = true;--> statement-breakpoint
-- Order flag is now "every line fully billed": clear it where a line still has quantity to bill.
UPDATE "purchase_orders" AS o SET "billed" = false WHERE o."billed" = true AND EXISTS (SELECT 1 FROM "purchase_order_lines" AS l WHERE l."order_id" = o."id" AND l."billed_qty" < l."quantity");
