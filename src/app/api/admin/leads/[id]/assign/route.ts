import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { sendOrQueueEmail, renderTemplate } from "@/lib/email";
import { voivodeshipName } from "@/lib/constants";
import { z } from "zod";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

/** Ręczny przydział leada do trenerki (admin). */
export async function POST(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const leadId = Number(id);

  const parsed = z.object({ trainerId: z.number().int().positive() }).safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(leadId) || !parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const db = await getDb();
  const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, leadId)).limit(1);
  const [trainer] = await db.select().from(schema.trainers).where(eq(schema.trainers.id, parsed.data.trainerId)).limit(1);
  if (!lead || !trainer) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });

  const existing = await db
    .select()
    .from(schema.leadAssignments)
    .where(and(eq(schema.leadAssignments.leadId, leadId), eq(schema.leadAssignments.trainerId, trainer.id)))
    .limit(1);
  if (existing[0]) return NextResponse.json({ error: "Lead już przydzielony do tej trenerki." }, { status: 409 });

  const settings = await getSettings();
  const [{ count }] = await db
    .select({ count: schema.leadAssignments.id })
    .from(schema.leadAssignments)
    .where(eq(schema.leadAssignments.leadId, leadId));
  void count; // liczba przydziałów sprawdzana niżej (multi-sell)

  const all = await db.select().from(schema.leadAssignments).where(eq(schema.leadAssignments.leadId, leadId));
  if (all.length >= 3) {
    return NextResponse.json({ error: "Osiągnięto twardy limit 3 trenerek per lead." }, { status: 409 });
  }
  if (all.length >= settings.multiSellLimit) {
    // miękkie ostrzeżenie — admin może świadomie przekroczyć limit z ustawień do max 3
  }

  const [assignment] = await db
    .insert(schema.leadAssignments)
    .values({
      leadId,
      trainerId: trainer.id,
      assignedBy: actorLabel(user),
      amount: trainer.billingModel === "per_lead" ? trainer.rate : 0,
    })
    .returning();

  if (lead.status === "nowy") {
    await db.update(schema.leads).set({ status: "przydzielony" }).where(eq(schema.leads.id, leadId));
  }

  if (trainer.email && !lead.anonymizedAt) {
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
      leadId,
    });
  }

  await logAudit({
    actor: actorLabel(user),
    action: "lead_przydzielony_recznie",
    entityType: "lead",
    entityId: leadId,
    details: { trainerId: trainer.id, trainerName: trainer.name },
  });

  return NextResponse.json(assignment);
}

/** Usunięcie przydziału. */
export async function DELETE(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const leadId = Number(id);
  const url = new URL(req.url);
  const trainerId = Number(url.searchParams.get("trainerId"));
  if (!Number.isInteger(leadId) || !Number.isInteger(trainerId)) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const db = await getDb();
  const deleted = await db
    .delete(schema.leadAssignments)
    .where(and(eq(schema.leadAssignments.leadId, leadId), eq(schema.leadAssignments.trainerId, trainerId)))
    .returning();
  if (!deleted[0]) return NextResponse.json({ error: "Nie znaleziono przydziału." }, { status: 404 });

  await logAudit({
    actor: actorLabel(user),
    action: "przydzial_usuniety",
    entityType: "lead",
    entityId: leadId,
    details: { trainerId },
  });
  return NextResponse.json({ ok: true });
}
