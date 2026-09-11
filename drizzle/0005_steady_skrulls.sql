-- Jedno okno „Kursantki": nowe źródła leada + ślad konwersji zgłoszenie -> lead.
-- IF NOT EXISTS jest dopisane ręcznie (drizzle-kit tego nie generuje): wdrożenie na
-- produkcji jest ręczne, więc realny jest scenariusz, w którym ktoś doda wartość enuma
-- z psql przed migracją. Bez IF NOT EXISTS cała transakcja migracji by wtedy padła.
ALTER TYPE "public"."lead_source" ADD VALUE IF NOT EXISTS 'quiz';--> statement-breakpoint
ALTER TYPE "public"."lead_source" ADD VALUE IF NOT EXISTS 'recepcjonistka';--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "converted_to_lead_id" integer;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "converted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_converted_to_lead_id_leads_id_fk" FOREIGN KEY ("converted_to_lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
