CREATE TABLE "abandoned_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"quiz_session_id" integer,
	"resume_token" varchar(64) NOT NULL,
	"email_queue_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "abandoned_reminders_email_unique" UNIQUE("email"),
	CONSTRAINT "abandoned_reminders_resume_token_unique" UNIQUE("resume_token")
);
--> statement-breakpoint
ALTER TABLE "abandoned_reminders" ADD CONSTRAINT "abandoned_reminders_quiz_session_id_quiz_sessions_id_fk" FOREIGN KEY ("quiz_session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "abandoned_reminders" ADD CONSTRAINT "abandoned_reminders_email_queue_id_email_queue_id_fk" FOREIGN KEY ("email_queue_id") REFERENCES "public"."email_queue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abandoned_reminders_session_idx" ON "abandoned_reminders" USING btree ("quiz_session_id");