ALTER TABLE "prospects" ADD COLUMN "last_contact_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "next_action_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "next_action_note" varchar(200);--> statement-breakpoint
CREATE INDEX "prospects_next_action_idx" ON "prospects" USING btree ("next_action_at");