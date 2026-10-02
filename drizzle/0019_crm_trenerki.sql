CREATE TABLE "crm_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"trainer_id" integer NOT NULL,
	"kind" varchar(30) NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"trainer_id" integer NOT NULL,
	"channel" varchar(10) NOT NULL,
	"to_address" varchar(255) NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"status" varchar(20) NOT NULL,
	"provider" varchar(20),
	"provider_id" varchar(80),
	"error" text,
	"segments" integer,
	"email_queue_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"trainer_id" integer NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"trainer_id" integer NOT NULL,
	"channel" varchar(10) DEFAULT 'email' NOT NULL,
	"name" varchar(120) NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_queue" ADD COLUMN "from_name" varchar(200);--> statement-breakpoint
ALTER TABLE "email_queue" ADD COLUMN "reply_to" varchar(255);--> statement-breakpoint
ALTER TABLE "lead_assignments" ADD COLUMN "crm_substage" varchar(30);--> statement-breakpoint
ALTER TABLE "lead_assignments" ADD COLUMN "next_contact_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "crm_events" ADD CONSTRAINT "crm_events_assignment_id_lead_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."lead_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_events" ADD CONSTRAINT "crm_events_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_messages" ADD CONSTRAINT "crm_messages_assignment_id_lead_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."lead_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_messages" ADD CONSTRAINT "crm_messages_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_messages" ADD CONSTRAINT "crm_messages_email_queue_id_email_queue_id_fk" FOREIGN KEY ("email_queue_id") REFERENCES "public"."email_queue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_assignment_id_lead_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."lead_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_notes" ADD CONSTRAINT "crm_notes_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_templates" ADD CONSTRAINT "crm_templates_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_events_assignment_idx" ON "crm_events" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "crm_messages_assignment_idx" ON "crm_messages" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "crm_messages_trainer_created_idx" ON "crm_messages" USING btree ("trainer_id","created_at");--> statement-breakpoint
CREATE INDEX "crm_notes_assignment_idx" ON "crm_notes" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "crm_templates_trainer_idx" ON "crm_templates" USING btree ("trainer_id");--> statement-breakpoint
CREATE INDEX "assign_trainer_next_idx" ON "lead_assignments" USING btree ("trainer_id","next_contact_at");