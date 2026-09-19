CREATE TABLE "marketing_suppression" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"token" varchar(64) NOT NULL,
	"opt_out_at" timestamp with time zone,
	"opt_out_source" varchar(40),
	"lookalike_allowed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_suppression_email_unique" UNIQUE("email"),
	CONSTRAINT "marketing_suppression_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "email_queue" ADD COLUMN "headers" jsonb;--> statement-breakpoint
CREATE INDEX "suppression_optout_idx" ON "marketing_suppression" USING btree ("opt_out_at");