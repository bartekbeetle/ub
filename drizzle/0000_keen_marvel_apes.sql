CREATE TYPE "public"."assignment_status" AS ENUM('przydzielony', 'skontaktowany', 'zapisana', 'odrzucony');--> statement-breakpoint
CREATE TYPE "public"."billing_model" AS ENUM('per_lead', 'per_zapis');--> statement-breakpoint
CREATE TYPE "public"."billing_status" AS ENUM('do_zafakturowania', 'zafakturowane', 'oplacone');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('szkic', 'opublikowane');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('w_kolejce', 'wyslany', 'blad');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('kurs', 'landing', 'konsultacja');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('nowy', 'przydzielony', 'skontaktowany', 'zapisana', 'rozliczony', 'odrzucony');--> statement-breakpoint
CREATE TYPE "public"."submission_type" AS ENUM('kontakt', 'konsultacja');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'trenerka');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor" varchar(120) NOT NULL,
	"action" varchar(80) NOT NULL,
	"entity_type" varchar(40) NOT NULL,
	"entity_id" integer,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(200) NOT NULL,
	"title" varchar(220) NOT NULL,
	"category" varchar(60) NOT NULL,
	"excerpt" text NOT NULL,
	"content" text NOT NULL,
	"image_url" text,
	"meta_title" varchar(200),
	"meta_description" varchar(300),
	"author" varchar(120) DEFAULT 'Redakcja Uniwersytet Beauty' NOT NULL,
	"reading_minutes" integer DEFAULT 5 NOT NULL,
	"status" "content_status" DEFAULT 'szkic' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(200) NOT NULL,
	"title" varchar(220) NOT NULL,
	"category" varchar(60) NOT NULL,
	"level" varchar(40) DEFAULT 'Podstawowy' NOT NULL,
	"mode" varchar(40) DEFAULT 'Stacjonarny' NOT NULL,
	"short_description" text,
	"description" text,
	"program" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"includes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"for_whom" text,
	"price_pln" integer NOT NULL,
	"subsidy_percent" integer DEFAULT 100 NOT NULL,
	"next_date" varchar(40),
	"total_spots" integer DEFAULT 8 NOT NULL,
	"taken_spots" integer DEFAULT 0 NOT NULL,
	"duration_hours" integer DEFAULT 16 NOT NULL,
	"city" varchar(100),
	"voivodeship" varchar(40),
	"image_url" text,
	"trainer_id" integer,
	"status" "content_status" DEFAULT 'szkic' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "email_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"to_email" varchar(255) NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" "email_status" DEFAULT 'w_kolejce' NOT NULL,
	"error" text,
	"lead_id" integer,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer NOT NULL,
	"trainer_id" integer NOT NULL,
	"status" "assignment_status" DEFAULT 'przydzielony' NOT NULL,
	"rejection_reason" text,
	"billing_status" "billing_status" DEFAULT 'do_zafakturowania' NOT NULL,
	"amount_pln" integer DEFAULT 0 NOT NULL,
	"assigned_by" varchar(60) DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"phone" varchar(40) NOT NULL,
	"email" varchar(255) NOT NULL,
	"voivodeship" varchar(40) NOT NULL,
	"category" varchar(60) NOT NULL,
	"employment_status" varchar(60) NOT NULL,
	"preferred_date" varchar(120),
	"message" text,
	"course_id" integer,
	"source" "lead_source" DEFAULT 'landing' NOT NULL,
	"utm_source" varchar(120),
	"utm_medium" varchar(120),
	"utm_campaign" varchar(160),
	"status" "lead_status" DEFAULT 'nowy' NOT NULL,
	"rejection_reason" text,
	"notes" text,
	"rodo_consent_at" timestamp with time zone NOT NULL,
	"anonymized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"trainer_id" integer NOT NULL,
	"author_name" varchar(120) NOT NULL,
	"rating" integer NOT NULL,
	"content" text NOT NULL,
	"course_title" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"multi_sell_limit" integer DEFAULT 2 NOT NULL,
	"default_rate_per_lead" integer DEFAULT 100 NOT NULL,
	"default_rate_per_signup" integer DEFAULT 500 NOT NULL,
	"notify_email" varchar(255) DEFAULT 'biuro@uniwersytetbeauty.pl' NOT NULL,
	"lead_email_subject" text DEFAULT 'Nowy lead z Uniwersytet Beauty — {{kategoria}}, {{wojewodztwo}}' NOT NULL,
	"lead_email_template" text DEFAULT 'Dzień dobry {{trenerka}},

mamy dla Ciebie nową kandydatkę na szkolenie:

Imię i nazwisko: {{imie}}
Telefon: {{telefon}}
Email: {{email}}
Kategoria: {{kategoria}}
Województwo: {{wojewodztwo}}
Status zawodowy: {{status_zawodowy}}

Prosimy o kontakt z kandydatką w ciągu 24h.

Pozdrawiamy,
Zespół Uniwersytet Beauty' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "submission_type" NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(40),
	"message" text,
	"is_handled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trainers" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(160) NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(255),
	"phone" varchar(40),
	"bio" text,
	"specializations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"city" varchar(100),
	"voivodeship" varchar(40),
	"avatar_url" text,
	"cover_url" text,
	"certificates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"instagram" text,
	"facebook" text,
	"website" text,
	"rating_x10" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"students_count" integer DEFAULT 0 NOT NULL,
	"billing_model" "billing_model" DEFAULT 'per_lead' NOT NULL,
	"rate_pln" integer DEFAULT 100 NOT NULL,
	"lead_limit_monthly" integer DEFAULT 50 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trainers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'trenerka' NOT NULL,
	"trainer_id" integer,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "courses_cat_idx" ON "courses" USING btree ("category");--> statement-breakpoint
CREATE INDEX "courses_voiv_idx" ON "courses" USING btree ("voivodeship");--> statement-breakpoint
CREATE INDEX "assign_lead_idx" ON "lead_assignments" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "assign_trainer_idx" ON "lead_assignments" USING btree ("trainer_id");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_created_idx" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");