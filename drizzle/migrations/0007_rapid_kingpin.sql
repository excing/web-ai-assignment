ALTER TABLE "image_gen_template" ADD COLUMN "required_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "level" integer DEFAULT 0 NOT NULL;