ALTER TABLE "stock_moves" ADD COLUMN "unit_cost_cents" bigint;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD COLUMN "value_cents" bigint;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "avg_cost_cents" bigint;