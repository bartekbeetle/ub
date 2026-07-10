import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSettings } from "./settings";
import { sendOrQueueEmail, renderTemplate } from "./email";
import { logAudit } from "./audit";
import { voivodeshipName } from "./constants";
import type { Lead, Trainer } from "@/db/schema";

/**
 * Automatyczna dystrybucja leada:
 * 1. Dopasowanie trenerek po kategorii + województwie (aktywne, w limicie miesięcznym)
 * 2. Multi-sell: max N trenerek (ustawienia), tylko z różnych miast
 * 3. Email do każdej trenerki + wpis w audit logu + status leada -> przydzielony
 */
export async function distributeLead(lead: Lead): Promise<{ assignedTo: Trainer[] }> {
  const db = await getDb();
  const settings = await getSettings();

  const candidates = await db
    .select()
    .from(schema.trainers)
    .where(
      and(
        eq(schema.trainers.isActive, true),
        eq(schema.trainers.voivodeship, lead.voivodeship),
        sql`${schema.trainers.specializations} @> ${JSON.stringify([lead.category])}::jsonb`
      )
    );

  // limit miesięczny per trenerka
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const withinLimit: Trainer[] = [];
  for (const t of candidates) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.leadAssignments)
      .where(
        and(
          eq(schema.leadAssignments.trainerId, t.id),
          gte(schema.leadAssignments.createdAt, monthStart)
        )
      );
    if (count < t.leadLimitMonthly) withinLimit.push(t);
  }

  // multi-sell: różne miasta, max limit z ustawień
  const chosen: Trainer[] = [];
  const usedCities = new Set<string>();
  for (const t of withinLimit) {
    if (chosen.length >= settings.multiSellLimit) break;
    const cityKey = (t.city ?? "").toLowerCase().trim();
    if (cityKey && usedCities.has(cityKey)) continue;
    chosen.push(t);
    if (cityKey) usedCities.add(cityKey);
  }

  if (chosen.length === 0) {
    await logAudit({
      actor: "system",
      action: "dystrybucja_brak_dopasowania",
      entityType: "lead",
      entityId: lead.id,
      details: { category: lead.category, voivodeship: lead.voivodeship },
    });
    return { assignedTo: [] };
  }

  for (const trainer of chosen) {
    const amount = trainer.billingModel === "per_lead" ? trainer.rate : 0;
    await db.insert(schema.leadAssignments).values({
      leadId: lead.id,
      trainerId: trainer.id,
      assignedBy: "system",
      amount,
    });

    if (trainer.email) {
      const vars = {
        trenerka: trainer.name,
        imie: lead.name,
        telefon: lead.phone,
        email: lead.email,
        kategoria: lead.category,
        wojewodztwo: voivodeshipName(lead.voivodeship),
        status_zawodowy: lead.employmentStatus,
      };
      await sendOrQueueEmail({
        to: trainer.email,
        subject: renderTemplate(settings.leadEmailSubject, vars),
        body: renderTemplate(settings.leadEmailTemplate, vars),
        leadId: lead.id,
      });
    }

    await logAudit({
      actor: "system",
      action: "lead_przydzielony",
      entityType: "lead",
      entityId: lead.id,
      details: { trainerId: trainer.id, trainerName: trainer.name, amount },
    });
  }

  await db
    .update(schema.leads)
    .set({ status: "przydzielony" })
    .where(eq(schema.leads.id, lead.id));

  await logAudit({
    actor: "system",
    action: "zmiana_statusu",
    entityType: "lead",
    entityId: lead.id,
    details: { from: "nowy", to: "przydzielony" },
  });

  return { assignedTo: chosen };
}
