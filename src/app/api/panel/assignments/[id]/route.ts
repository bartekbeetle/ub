import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireTrainer } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { z } from "zod";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

const patchSchema = z.object({
  status: z.enum(["przydzielony", "skontaktowany", "zapisana", "odrzucony"]),
  rejectionReason: z.string().max(1000).optional(),
});

/**
 * Zmiana statusu WŁASNEGO przydziału przez trenerkę.
 * Twarda izolacja: przydział musi należeć do trainerId z sesji, inaczej 404.
 * Logika naliczania kwoty odwzorowana 1:1 z panelu admina (assignments/[id]).
 */
export async function PATCH(req: Request, { params }: { params: Params }) {
  const user = await requireTrainer();
  if (!user || !user.trainerId) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const assignmentId = Number(id);
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(assignmentId) || !parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const db = await getDb();
  // izolacja: pobierz przydział TYLKO gdy trainerId zgadza się z sesją
  const rows = await db
    .select({ assignment: schema.leadAssignments, trainer: schema.trainers })
    .from(schema.leadAssignments)
    .innerJoin(schema.trainers, eq(schema.leadAssignments.trainerId, schema.trainers.id))
    .where(and(eq(schema.leadAssignments.id, assignmentId), eq(schema.leadAssignments.trainerId, user.trainerId)))
    .limit(1);
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Nie znaleziono przydziału." }, { status: 404 });

  const { status, rejectionReason } = parsed.data;
  if (status === "odrzucony" && !rejectionReason?.trim()) {
    return NextResponse.json({ error: "Podaj powód odrzucenia." }, { status: 400 });
  }

  const update: Partial<typeof schema.leadAssignments.$inferInsert> = {};
  if (status !== row.assignment.status) {
    update.status = status;
    if (status === "odrzucony") update.rejectionReason = rejectionReason?.trim() || null;
    if (status === "zapisana") {
      // naliczenie: per_zapis -> stawka trenerki; per_lead -> kwota naliczona przy przydziale
      if (row.trainer.billingModel === "per_zapis") update.amount = row.trainer.rate;
      // eskaluj status leada
      await db.update(schema.leads).set({ status: "zapisana" }).where(eq(schema.leads.id, row.assignment.leadId));
      await logAudit({
        actor: actorLabel(user),
        action: "zmiana_statusu",
        entityType: "lead",
        entityId: row.assignment.leadId,
        details: { to: "zapisana", via: `assignment:${assignmentId}` },
      });
    }
    await logAudit({
      actor: actorLabel(user),
      action: "zmiana_statusu_przydzialu",
      entityType: "assignment",
      entityId: assignmentId,
      details: { from: row.assignment.status, to: status, trainerId: row.trainer.id },
    });
  }

  const [updated] = await db
    .update(schema.leadAssignments)
    .set(update)
    .where(and(eq(schema.leadAssignments.id, assignmentId), eq(schema.leadAssignments.trainerId, user.trainerId)))
    .returning();
  return NextResponse.json(updated);
}
