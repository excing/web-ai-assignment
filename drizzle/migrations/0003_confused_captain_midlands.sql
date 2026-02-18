ALTER TABLE "ai_proxy_assignment" ADD COLUMN "health_status" text DEFAULT 'healthy' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_proxy_assignment" ADD COLUMN "unhealthy_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_proxy_assignment" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "ai_proxy_assignment" ADD COLUMN "last_error_at" timestamp;--> statement-breakpoint
ALTER TABLE "ai_proxy" DROP COLUMN "health_status";--> statement-breakpoint
ALTER TABLE "ai_proxy" DROP COLUMN "unhealthy_count";--> statement-breakpoint
ALTER TABLE "ai_proxy" DROP COLUMN "last_error";--> statement-breakpoint
ALTER TABLE "ai_proxy" DROP COLUMN "last_error_at";--> statement-breakpoint
ALTER TABLE "ai_proxy_assignment" DROP COLUMN "models";