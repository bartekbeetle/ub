CREATE TABLE "quiz_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_key" varchar(64) NOT NULL,
	"name" varchar(160),
	"email" varchar(200),
	"phone" varchar(40),
	"category" varchar(60),
	"voivodeship" varchar(40),
	"city" varchar(120),
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"step_reached" integer DEFAULT 1 NOT NULL,
	"max_step_reached" integer DEFAULT 1 NOT NULL,
	"marketing_consent_at" timestamp with time zone,
	"consent_version" varchar(20),
	"completed" boolean DEFAULT false NOT NULL,
	"lead_id" integer,
	"utm_source" varchar(120),
	"utm_medium" varchar(120),
	"utm_campaign" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_sessions_session_key_unique" UNIQUE("session_key")
);
--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quiz_sessions_completed_idx" ON "quiz_sessions" USING btree ("completed");--> statement-breakpoint
CREATE INDEX "quiz_sessions_email_idx" ON "quiz_sessions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "quiz_sessions_maxstep_idx" ON "quiz_sessions" USING btree ("max_step_reached");