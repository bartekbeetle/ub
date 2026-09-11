-- IF NOT EXISTS dopisane ręcznie: wdrożenia na tym projekcie są ręczne, więc scenariusz
-- "ktoś dodał wartość z psql przed migracją" jest realny, a bez tego padłaby CAŁA transakcja.
ALTER TYPE "public"."lead_source" ADD VALUE IF NOT EXISTS 'quiz';--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE IF NOT EXISTS 'recepcjonistka';--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "converted_to_lead_id" integer;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "converted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_converted_to_lead_id_leads_id_fk" FOREIGN KEY ("converted_to_lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;