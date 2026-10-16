CREATE TABLE "email_templates" (
	"kind" varchar(40) PRIMARY KEY NOT NULL,
	"subject" text,
	"body" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_by" varchar(160),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_queue" ADD COLUMN "track_token" varchar(40);--> statement-breakpoint
ALTER TABLE "email_queue" ADD COLUMN "opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_queue" ADD COLUMN "open_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_queue" ADD COLUMN "clicked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_queue" ADD COLUMN "click_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "tracking_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "email_queue_track_token_idx" ON "email_queue" USING btree ("track_token");--> statement-breakpoint
CREATE INDEX "email_queue_created_idx" ON "email_queue" USING btree ("created_at");