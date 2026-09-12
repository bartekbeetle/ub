CREATE TYPE "public"."conversation_channel" AS ENUM('czat', 'telefon', 'sms', 'email', 'instagram', 'facebook');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('aktywna', 'zakonczona', 'przekazana_czlowiekowi', 'porzucona');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('kursantka', 'recepcjonistka', 'operator', 'system');--> statement-breakpoint
CREATE TYPE "public"."project_track" AS ENUM('osoby_dorosle', 'przedsiebiorcy', 'nieznana');--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"channel" "conversation_channel" NOT NULL,
	"status" "conversation_status" DEFAULT 'aktywna' NOT NULL,
	"public_token" varchar(64),
	"external_ref" varchar(200),
	"ai_disclosed_at" timestamp with time zone,
	"contact_consent_at" timestamp with time zone,
	"summary" text,
	"handover_reason" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "has_business_activity" boolean;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "project_track" "project_track" DEFAULT 'nieznana' NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "city" varchar(120);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "own_contribution_ok" boolean;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "start_window" varchar(120);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "travel_km" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "bur_operator_name" varchar(200);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "bur_project_number" varchar(60);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "bur_deadline_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "bur_account_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "bur_operator_identified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "bur_application_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "bur_decision_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "bur_contract_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "bur_enrolled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "enrollment_confirmed_by_lead" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "last_contact_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "last_reply_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "next_action_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "project_tracks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "serves_voivodeships" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conv_lead_idx" ON "conversations" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "conv_status_idx" ON "conversations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "conv_token_idx" ON "conversations" USING btree ("public_token");--> statement-breakpoint
CREATE INDEX "msg_conv_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "leads_track_idx" ON "leads" USING btree ("project_track");--> statement-breakpoint
CREATE INDEX "leads_reply_idx" ON "leads" USING btree ("last_reply_at");