import { NextResponse } from "next/server";
import { eq, and, ne } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { leadStatusUpdateSchema } from "@/lib/validators";
import { z } from "zod";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const leadId = Number(id);
  if (!Number.isInteger(leadId)) return NextResponse.json({ error: "Nieprawidłowe ID." }, { status: 400 });

  const db = await getDb();
  const rows = await db.select().from(schema.leads).where(eq(schema.leads.id, leadId)).limit(1);
  if (!rows[0]) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  return NextResponse.json(rows[0]);
}

const patchSchema = z.union([
  leadStatusUpdateSchema.extend({ notes: z.string().max(4000).optional() }),
  z.object({ notes: z.string().max(4000) }),
]);

export async function PATCH(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const leadId = Number(id);
  if (!Number.isInteger(leadId)) return NextResponse.json({ error: "Nieprawidłowe ID." }, { status: 400 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });

  const db = await getDb();
  const rows = await db.select().from(schema.leads).where(eq(schema.leads.id, leadId)).limit(1);
  const lead = rows[0];
  if (!lead) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });

  const data = parsed.data;
  const update: Partial<typeof schema.leads.$inferInsert> = {};
  if ("notes" in data && data.notes !== undefined) update.notes = data.notes;

  if ("status" in data && data.status && data.status !== lead.status) {
    update.status = data.status;
    if (data.status === "odrzucony") update.rejectionReason = data.rejectionReason || null;

    // status "zapisana" -> naliczenie kwot dla przydziałów per-zapis
    if (data.status === "zapisana") {
      const assignments = await db
        .select({ assignment: schema.leadAssignments, trainer: schema.trainers })
        .from(schema.leadAssignments)
        .innerJoin(schema.trainers, eq(schema.leadAssignments.trainerId, schema.trainers.id))
        .where(and(eq(schema.leadAssignments.leadId, leadId), ne(schema.leadAssignments.status, "odrzucony")));
      for (const { assignment, trainer } of assignments) {
        await db
          .update(schema.leadAssignments)
          .set({
            status: "zapisana",
            amount: trainer.billingModel === "per_zapis" ? trainer.rate : assignment.amount,
          })
          .where(eq(schema.leadAssignments.id, assignment.id));
      }
    }

    await logAudit({
      actor: actorLabel(user),
      action: "zmiana_statusu",
      entityType: "lead",
      entityId: leadId,
      details: { from: lead.status, to: data.status, ...(data.status === "odrzucony" ? { reason: data.rejectionReason } : {}) },
    });
  } else if ("notes" in data) {
    await logAudit({ actor: actorLabel(user), action: "notatka", entityType: "lead", entityId: leadId });
  }

  const [updated] = await db.update(schema.leads).set(update).where(eq(schema.leads.id, leadId)).returning();
  return NextResponse.json(updated);
}

/**
 * Trwałe usunięcie leada z bazy — dla rekordów testowych i śmieciowych, które zawyżają
 * liczniki i psują pomiar konwersji.
 *
 * To NIE jest ścieżka RODO. Żądanie „prawa do bycia zapomnianą" obsługuje `POST .../anonymize`,
 * które zostawia wiersz (historia przydziałów i rozliczeń musi przeżyć), czyszcząc dane osobowe.
 * Tutaj wiersz znika razem z przydziałami — używać tylko wtedy, gdy rekord nigdy nie był realną
 * kursantką.
 *
 * Ślad po usunięciu zostaje w `audit_log` (kto, kiedy, jaki to był rekord) — zapisywany PRZED
 * kasowaniem, żeby nie zniknął razem z wierszem.
 */
export async function DELETE(_req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const leadId = Number(id);
  if (!Number.isInteger(leadId)) return NextResponse.json({ error: "Nieprawidłowe ID." }, { status: 400 });

  const db = await getDb();
  const rows = await db.select().from(schema.leads).where(eq(schema.leads.id, leadId)).limit(1);
  const lead = rows[0];
  if (!lead) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });

  // Ślad idzie do audytu ZANIM wiersz zniknie.
  await logAudit({
    actor: actorLabel(user),
    action: "usuniecie_leada",
    entityType: "lead",
    entityId: leadId,
    details: {
      name: lead.name,
      source: lead.source,
      status: lead.status,
      category: lead.category,
      voivodeship: lead.voivodeship,
      createdAt: lead.createdAt?.toISOString?.() ?? null,
    },
  });

  // `quiz_sessions.lead_id` nie ma ON DELETE — bez rozbrojenia baza odrzuci kasowanie
  // każdego leada, który przyszedł z quizu (czyli dziś: większości).
  await db
    .update(schema.quizSessions)
    .set({ leadId: null })
    .where(eq(schema.quizSessions.leadId, leadId));

  // Reszta powiązań ma ON DELETE w schemacie: przydziały kaskadują,
  // zgłoszenia / prospekty / rozmowy / zadania researchu dostają NULL.
  await db.delete(schema.leads).where(eq(schema.leads.id, leadId));

  return NextResponse.json({ ok: true });
}
