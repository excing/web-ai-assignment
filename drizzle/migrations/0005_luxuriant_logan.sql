CREATE TABLE "image_gen_template" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"prompt" text NOT NULL,
	"preview_image_url" text,
	"description" text,
	"image_count_min" integer DEFAULT 0 NOT NULL,
	"image_count_max" integer DEFAULT 0 NOT NULL,
	"assignment_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "image_gen_template" ADD CONSTRAINT "image_gen_template_assignment_id_ai_proxy_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."ai_proxy_assignment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "image_gen_template_category_idx" ON "image_gen_template" USING btree ("category");--> statement-breakpoint
CREATE INDEX "image_gen_template_is_active_idx" ON "image_gen_template" USING btree ("is_active");