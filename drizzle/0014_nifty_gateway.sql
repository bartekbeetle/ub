CREATE TYPE "public"."mailing_recipient_status" AS ENUM('oczekuje', 'w_kolejce', 'wyslany', 'pominiety', 'blad');--> statement-breakpoint
CREATE TYPE "public"."mailing_status" AS ENUM('szkic', 'gotowa', 'wysylanie', 'zakonczona');--> statement-breakpoint
CREATE TABLE "mailing_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"segment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "mailing_status" DEFAULT 'szkic' NOT NULL,
	"created_by" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"prepared_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "mailing_recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(160),
	"source_kind" varchar(20) DEFAULT 'lead' NOT NULL,
	"lead_id" integer,
	"status" "mailing_recipient_status" DEFAULT 'oczekuje' NOT NULL,
	"reason" text,
	"email_queue_id" integer,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "mailing_recipients" ADD CONSTRAINT "mailing_recipients_campaign_id_mailing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."mailing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mailing_recipients" ADD CONSTRAINT "mailing_recipients_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mailing_recipients" ADD CONSTRAINT "mailing_recipients_email_queue_id_email_queue_id_fk" FOREIGN KEY ("email_queue_id") REFERENCES "public"."email_queue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mailing_campaigns_status_idx" ON "mailing_campaigns" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "mailing_recipients_campaign_email_idx" ON "mailing_recipients" USING btree ("campaign_id","email");--> statement-breakpoint
CREATE INDEX "mailing_recipients_status_idx" ON "mailing_recipients" USING btree ("campaign_id","status");