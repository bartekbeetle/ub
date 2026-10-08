CREATE TABLE "phone_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" varchar(20) NOT NULL,
	"outcome" varchar(20) NOT NULL,
	"note" text,
	"admin_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phone_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"direction" varchar(3) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"body" text NOT NULL,
	"status" varchar(20) NOT NULL,
	"provider" varchar(20),
	"provider_id" varchar(80),
	"error" text,
	"admin_user_id" integer,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "phone_calls" ADD CONSTRAINT "phone_calls_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phone_messages" ADD CONSTRAINT "phone_messages_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "phone_calls_phone_idx" ON "phone_calls" USING btree ("phone","created_at");--> statement-breakpoint
CREATE INDEX "phone_messages_phone_idx" ON "phone_messages" USING btree ("phone","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "phone_messages_in_provider_uq" ON "phone_messages" USING btree ("direction","provider_id");