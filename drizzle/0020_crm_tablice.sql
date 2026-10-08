CREATE TABLE "crm_boards" (
	"id" serial PRIMARY KEY NOT NULL,
	"trainer_id" integer NOT NULL,
	"category" varchar(60) NOT NULL,
	"name" varchar(200) NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_assignments" ADD COLUMN "board_id" integer;--> statement-breakpoint
ALTER TABLE "lead_assignments" ADD COLUMN "admin_stage" varchar(30);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "qualification" varchar(20) DEFAULT 'nowa' NOT NULL;--> statement-breakpoint
ALTER TABLE "crm_boards" ADD CONSTRAINT "crm_boards_trainer_id_trainers_id_fk" FOREIGN KEY ("trainer_id") REFERENCES "public"."trainers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crm_boards_trainer_cat_uq" ON "crm_boards" USING btree ("trainer_id","category");--> statement-breakpoint
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_board_id_crm_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."crm_boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assign_board_idx" ON "lead_assignments" USING btree ("board_id");