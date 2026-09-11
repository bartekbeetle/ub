CREATE TYPE "public"."bur_segment" AS ENUM('A', 'B', 'nieznany');--> statement-breakpoint
CREATE TYPE "public"."prospect_activity_type" AS ENUM('notatka', 'telefon', 'email', 'spotkanie', 'zmiana_statusu');--> statement-breakpoint
CREATE TYPE "public"."prospect_priority" AS ENUM('wysoki', 'sredni', 'niski');--> statement-breakpoint
CREATE TYPE "public"."prospect_status" AS ENUM('potencjalny', 'research', 'do_kontaktu', 'kontakt', 'rozmowa', 'umowa', 'aktywna', 'odrzucony', 'parking');--> statement-breakpoint
CREATE TYPE "public"."research_job_status" AS ENUM('pending', 'w_toku', 'gotowe', 'pominiete');--> statement-breakpoint
CREATE TABLE "prospect_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"prospect_id" integer NOT NULL,
	"type" "prospect_activity_type" DEFAULT 'notatka' NOT NULL,
	"content" text NOT NULL,
	"created_by" varchar(60) DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"legal_name" varchar(250),
	"nip" varchar(20),
	"krs" varchar(20),
	"city" varchar(100),
	"voivodeship" varchar(40),
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"phone" varchar(40),
	"email" varchar(255),
	"website" text,
	"instagram" text,
	"facebook" text,
	"status" "prospect_status" DEFAULT 'potencjalny' NOT NULL,
	"priority" "prospect_priority" DEFAULT 'sredni' NOT NULL,
	"source" varchar(60) DEFAULT 'reczny' NOT NULL,
	"bur_segment" "bur_segment" DEFAULT 'nieznany' NOT NULL,
	"bur_provider_id" varchar(20),
	"bur_url" text,
	"bur_services_completed" integer,
	"bur_services_active" integer,
	"bur_rating_x10" integer,
	"bur_review_count" integer,
	"bur_checked_at" timestamp with time zone,
	"dossier_path" text,
	"research_notes" text,
	"researched_at" timestamp with time zone,
	"trainer_id" integer,
	"triggered_by_lead_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"voivodeship" varchar(40) NOT NULL,
	"category" varchar(60) NOT NULL,
	"status" "research_job_status" DEFAULT 'pending' NOT NULL,
	"result_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "prospect_activities" ADD CONSTRAINT "prospect_activities_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_triggered_by_lead_id_leads_id_fk" FOREIGN KEY ("triggered_by_lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prospect_activities_prospect_idx" ON "prospect_activities" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "prospects_status_idx" ON "prospects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "prospects_voiv_idx" ON "prospects" USING btree ("voivodeship");--> statement-breakpoint
CREATE INDEX "prospects_bur_idx" ON "prospects" USING btree ("bur_segment");--> statement-breakpoint
CREATE INDEX "research_jobs_status_idx" ON "research_jobs" USING btree ("status");