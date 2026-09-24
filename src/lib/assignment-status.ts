import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { logAudit, actorLabel } from "@/lib/audit";
import { onLeadSigned } from "@/lib/lead-events";
import { ONBOARDING_GATE_MESSAGE } from "@/lib/mobile-auth";
import type { LeadAssignment, User } from "@/db/schema";

/**
 * ZMIANA STATUSU WŁASNEGO PRZYDZIAŁU PRZEZ TRENERKĘ — jedno miejsce dla panelu i telefonu.
 *
 * Wyciągnięte z `POST /api/panel/assignments/[id]` 1:1, gdy powstała aplikacja mobilna.
 * Powód: przejście na „zapisana" nalicza należność i wysyła maile do kursantki — dwie kopie
 * tej logiki rozjechałyby się przy pierwszej zmianie cennika i zaczęły naliczać różne kwoty
 * zależnie od tego, czy trenerka kliknęła w przeglądarce, czy w telefonie.
 */

export const assignmentStatusSchema = z.object({
  status: z.enum(["przydzielony", "skontaktowany", "zapisana", "odrzucony"]),
  rejectionReason: z.string().max(1000).optional(),
});

export type AssignmentStatusInput = z.infer<typeof assignmentStatusSchema>;

export type AssignmentStatusResult =
  | { ok: true; assignment: LeadAssignment }
  | { ok: false; status: number; error: string };

export async function updateTrainerAssignmentStatus(params: {
  user: User;
  trainerId: number;
  assignmentId: number;
  input: AssignmentStatusInput;
}): Promise<AssignmentStatusResult> {
  const { user, trainerId, assignmentId, input } = params;
  if (!Number.isInteger(assignmentId)) {
    return { ok: false, status: 400, error: "Nieprawidłowe dane." };
  }

  const db = await getDb();
  // izolacja: pobierz przydział TYLKO gdy trainerId zgadza się z sesją
  const rows = await db
    .select({ assignment: schema.leadAssignments, trainer: schema.trainers })
    .from(schema.leadAssignments)
    .innerJoin(schema.trainers, eq(schema.leadAssignments.trainerId, schema.trainers.id))
    .where(and(eq(schema.leadAssignments.id, assignmentId), eq(schema.leadAssignments.trainerId, trainerId)))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false, status: 404, error: "Nie znaleziono przydziału." };

  // BRAMKA ONBOARDINGU (ta sama co na stronach panelu): konto z samodzielnej rejestracji,
  // zanim zostanie aktywowane, nie może dotknąć przydziału — także wtedy, gdy ktoś wyśle
  // PATCH-a z palca, omijając interfejs. Zmiana statusu na „zapisana” uruchamia maile
  // do kursantki i nalicza należność, więc to nie jest tylko kwestia widoczności.
  if (!row.trainer.isActive) {
    return { ok: false, status: 403, error: ONBOARDING_GATE_MESSAGE };
  }

  const { status, rejectionReason } = input;
  if (status === "odrzucony" && !rejectionReason?.trim()) {
    return { ok: false, status: 400, error: "Podaj powód odrzucenia." };
  }

  // Ustawiane tylko przy przejściu na „zapisana" — maile wysyłamy PO zapisie przydziału,
  // bo `onLeadSigned` czyta z bazy przydział o tym statusie (nazwa akademii, kwota).
  let signedLeadId: number | null = null;
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
    .where(and(eq(schema.leadAssignments.id, assignmentId), eq(schema.leadAssignments.trainerId, trainerId)))
    .returning();

  if (signedLeadId !== null) {
    await onLeadSigned({
      leadId: signedLeadId,
      trainerName: row.trainer.name,
      actor: actorLabel(user),
    });
  }

  return { ok: true, assignment: updated };
}
