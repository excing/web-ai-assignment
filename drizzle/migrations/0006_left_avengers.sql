ALTER TABLE "ai_proxy_assignment" ADD COLUMN "backup_proxy_id" text;--> statement-breakpoint
ALTER TABLE "ai_proxy_assignment" ADD COLUMN "backup_model" text;--> statement-breakpoint
ALTER TABLE "ai_proxy_assignment" ADD CONSTRAINT "ai_proxy_assignment_backup_proxy_id_ai_proxy_id_fk" FOREIGN KEY ("backup_proxy_id") REFERENCES "public"."ai_proxy"("id") ON DELETE set null ON UPDATE no action;