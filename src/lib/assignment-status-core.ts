/**
 * RDZEŃ zmiany statusu przydziału przez trenerkę — bez `server-only` i bez singletona bazy,
 * żeby dało się go przetestować na PGlite (`npm run test:crm`).
 * W aplikacji wołaj `updateTrainerAssignmentStatus` z `@/lib/assignment-status`.
 *
 * TO JEST JEDYNE MIEJSCE, w którym trenerka (panel, telefon, CRM) naliczają należność:
 * przejście na „zapisana" ustawia `amount`, eskaluje status leada, pisze do `audit_log`
 * i woła `onSigned` (maile do kursantki i do nas). Treść funkcji jest przeniesiona 1:1
 * z poprzedniej wersji; jedyna zmiana to wstrzyknięcie bazy i `onSigned`.
 */
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@/db/schema";
import type { AnyDb } from "@/lib/admin-audit-core";
import type { LeadAssignment, User } from "@/db/schema";

/** Komunikat bramki onboardingu — jeden tekst dla wszystkich tras (panel, telefon, CRM). */
export const ONBOARDING_GATE_MESSAGE =
  "Konto czeka na aktywację. Skontaktujemy się telefonicznie przed pierwszym zgłoszeniem.";

export const assignmentStatusSchema = z.object({
  status: z.enum(["przydzielony", "skontaktowany", "zapisana", "odrzucony"]),
  rejectionReason: z.string().max(1000).optional(),
});

export type AssignmentStatusInput = z.infer<typeof assignmentStatusSchema>;

export type AssignmentStatusResult =
  | { ok: true; assignment: LeadAssignment }
  | { ok: false; status: number; error: string };

export type StatusActor = Pick<User, "id" | "email">;

export function statusActorLabel(user: StatusActor | null): string {
  return user ? `user:${user.id} ${user.email}` : "system";
}

export type OnSigned = (p: { leadId: number; trainerName: string; actor: string }) => Promise<void>;

async function writeAudit(
  db: AnyDb,
  p: { actor: string; action: string; entityType: string; entityId: number; details: Record<string, unknown> }
) {
  await db.insert(schema.auditLog).values({
    actor: p.actor,
    action: p.action,
    entityType: p.entityType,
    entityId: p.entityId,
    details: p.details,
  });
}

export async function updateTrainerAssignmentStatusCore(
  db: AnyDb,
  params: {
    user: StatusActor;
    trainerId: number;
    assignmentId: number;
    input: AssignmentStatusInput;
  },
  deps: { onSigned: OnSigned }
): Promise<AssignmentStatusResult> {
  const { user, trainerId, assignmentId, input } = params;
  if (!Number.isInteger(assignmentId)) {
    return { ok: false, status: 400, error: "Nieprawidłowe dane." };
  }

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
      await writeAudit(db, {
        actor: statusActorLabel(user),
        action: "zmiana_statusu",
        entityType: "lead",
        entityId: row.assignment.leadId,
        details: { to: "zapisana", via: `assignment:${assignmentId}` },
      });
      signedLeadId = row.assignment.leadId;
    }
    await writeAudit(db, {
      actor: statusActorLabel(user),
      action: "zmiana_statusu_przydzialu",
      entityType: "assignment",
      entityId: assignmentId,
      details: { from: row.assignment.status, to: status, trainerId: row.trainer.id },
    });
  }

  // Pusty `update` (ten sam status) nie może zrobić `UPDATE ... SET` bez kolumn — drizzle rzuca.
  let updated: LeadAssignment;
  if (Object.keys(update).length === 0) {
    updated = row.assignment;
  } else {
    [updated] = await db
      .update(schema.leadAssignments)
      .set(update)
      .where(and(eq(schema.leadAssignments.id, assignmentId), eq(schema.leadAssignments.trainerId, trainerId)))
      .returning();
  }

  if (signedLeadId !== null) {
    await deps.onSigned({
      leadId: signedLeadId,
      trainerName: row.trainer.name,
      actor: statusActorLabel(user),
    });
  }

  return { ok: true, assignment: updated };
}
