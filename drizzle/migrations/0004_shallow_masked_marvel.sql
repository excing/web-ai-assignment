ALTER TABLE "ai_proxy_assignment" ADD COLUMN "billing_mode" text;--> statement-breakpoint
ALTER TABLE "ai_proxy_assignment" ADD COLUMN "input_per_1k" integer;--> statement-breakpoint
ALTER TABLE "ai_proxy_assignment" ADD COLUMN "output_per_1k" integer;--> statement-breakpoint
ALTER TABLE "ai_proxy_assignment" ADD COLUMN "minimum" integer;