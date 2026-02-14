ALTER TABLE "redemption_code" ADD COLUMN "package_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "redemption_code" ADD COLUMN "package_credits" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "redemption_code" ADD COLUMN "package_price" integer NOT NULL;