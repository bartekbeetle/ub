import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { onLeadSigned } from "@/lib/lead-events";
import { z } from "zod";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

const patchSchema = z.object({
  status: z.enum(["przydzielony", "skontaktowany", "zapisana", "odrzucony"]).optional(),
  rejectionReason: z.string().max(1000).optional(),
  billingStatus: z.enum(["do_zafakturowania", "zafakturowane", "oplacone"]).optional(),
});

/** Zmiana statusu przydziału (per trenerka) — zasila rozliczenia (attribution). */
export async function PATCH(req: Request, { params }: { params: Params }) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const { id } = await params;
  const assignmentId = Number(id);
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(assignmentId) || !parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const db = await getDb();
  const rows = await db
    .select({ assignment: schema.leadAssignments, trainer: schema.trainers })
    .from(schema.leadAssignments)
    .innerJoin(schema.trainers, eq(schema.leadAssignments.trainerId, schema.trainers.id))
    .where(eq(schema.leadAssignments.id, assignmentId))
    .limit(1);
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });

  // Patrz komentarz w `@/lib/lead-events`: maile lecą PO zapisie przydziału, jednym wspólnym
  // wywołaniem, a przed duplikatem (admin i trenerka klikają ten sam zapis) chroni `kind`.
  let signedLeadId: number | null = null;
  const update: Partial<typeof schema.leadAssignments.$inferInsert> = {};
  const { status, rejectionReason, billingStatus } = parsed.data;

  if (billingStatus) update.billingStatus = billingStatus;
  if (status && status !== row.assignment.status) {
    update.status = status;
    if (status === "odrzucony") update.rejectionReason = rejectionReason || null;
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
      signedLeadId = row.assignment.leadId;
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
    .where(eq(schema.leadAssignments.id, assignmentId))
    .returning();

  if (signedLeadId !== null) {
    await onLeadSigned({
      leadId: signedLeadId,
      trainerName: row.trainer.name,
      actor: actorLabel(user),
    });
  }

  return NextResponse.json(updated);
}
