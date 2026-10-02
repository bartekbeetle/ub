/**
 * RDZEŃ zmiany statusu przydziału przez trenerkę — bez `server-only` i bez singletona bazy,
 * żeby dało się go przetestować na PGlite (`npm run test:crm`).
 * W aplikacji wołaj `updateTrainerAssignmentStatus` z `@/lib/assignment-status`.
 *
 * TO JEST JEDYNE MIEJSCE, w którym ktokolwiek (trenerka: panel/telefon/CRM, admin: /api/admin/assignments)
 * naliczą należność i wyjdzie z niej:
 * przejście na „zapisana" ustawia `amount`, eskaluje status leada, pisze do `audit_log`
 * i woła `onSigned` (maile do kursantki i do nas). Treść funkcji jest przeniesiona 1:1
 * z poprzedniej wersji; jedyna zmiana to wstrzyknięcie bazy i `onSigned`.
 */
import { and, eq, ne } from "drizzle-orm";
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

export type OnSigned = (p: {
  leadId: number;
  assignmentId: number;
  trainerName: string;
  actor: string;
}) => Promise<void>;

export type AuditFn = (p: {
  action: string;
  entityType: string;
  entityId: number;
  details: Record<string, unknown>;
}) => Promise<void>;

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

export const SIGNED_LOCKED_TRAINER =
  "Zapis jest już naliczony. Jeśli to pomyłka, napisz do biura Uniwersytetu Beauty.";
export const SIGNED_LOCKED_ADMIN = "Cofnięcie zapisu (zdjęcie naliczenia) może wykonać tylko superadmin.";
export const SIGNED_LOCKED_BILLED =
  "Należność jest już zafakturowana lub opłacona. Najpierw cofnij status płatności, potem zapis.";

/** Zakres operacji: trenerka widzi tylko swój przydział; admin każdy, cofnięcie zapisu tylko superadmin. */
export type StatusScope =
  | { kind: "trainer"; trainerId: number }
  | { kind: "admin"; canUndoSigned: boolean };

export type StatusChange = {
  status?: AssignmentStatusInput["status"];
  rejectionReason?: string;
  /** Tylko scope admin (i tylko superadmin — bramka w trasie). Trenerka nie ma na to wejścia. */
  billingStatus?: "do_zafakturowania" | "zafakturowane" | "oplacone";
};

/**
 * JEDNA ścieżka zmiany statusu przydziału. Naliczenie (amount ze stawki trenerki dla per_zapis),
 * eskalacja `leads.status`, `audit_log` i `onSigned` dzieją się wyłącznie tu i tylko przy realnym
 * przejściu na „zapisana" (powtórka tego samego statusu jest no-opem).
 * Wyjście Z „zapisana": trenerka nigdy (409, jak w CRM); admin tylko superadmin, tylko gdy
 * należność nie jest zafakturowana — wtedy zerujemy `amount` i, gdy to była jedyna zapisana
 * akademia, cofamy status leada.
 */
export async function changeAssignmentStatusCore(
  db: AnyDb,
  params: { user: StatusActor; assignmentId: number; scope: StatusScope; change: StatusChange },
  deps: { onSigned: OnSigned; audit?: AuditFn }
): Promise<AssignmentStatusResult> {
  const { user, assignmentId, scope, change } = params;
  if (!Number.isInteger(assignmentId)) {
    return { ok: false, status: 400, error: "Nieprawidłowe dane." };
  }
  const audit: AuditFn =
    deps.audit ?? ((p) => writeAudit(db, { actor: statusActorLabel(user), ...p }));

  // izolacja: trenerka dostaje przydział TYLKO gdy trainerId zgadza się z sesją
  const conds = [eq(schema.leadAssignments.id, assignmentId)];
  if (scope.kind === "trainer") conds.push(eq(schema.leadAssignments.trainerId, scope.trainerId));
  const rows = await db
    .select({ assignment: schema.leadAssignments, trainer: schema.trainers })
    .from(schema.leadAssignments)
    .innerJoin(schema.trainers, eq(schema.leadAssignments.trainerId, schema.trainers.id))
    .where(and(...conds))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false, status: 404, error: "Nie znaleziono przydziału." };

  // BRAMKA ONBOARDINGU (ta sama co na stronach panelu): konto z samodzielnej rejestracji,
  // zanim zostanie aktywowane, nie może dotknąć przydziału — także wtedy, gdy ktoś wyśle
  // PATCH-a z palca, omijając interfejs. Zmiana statusu na „zapisana” uruchamia maile
  // do kursantki i nalicza należność, więc to nie jest tylko kwestia widoczności.
  if (scope.kind === "trainer" && !row.trainer.isActive) {
    return { ok: false, status: 403, error: ONBOARDING_GATE_MESSAGE };
  }

  const { rejectionReason, billingStatus } = change;
  const status = change.status ?? row.assignment.status;
  if (scope.kind === "trainer" && status === "odrzucony" && !rejectionReason?.trim()) {
    return { ok: false, status: 400, error: "Podaj powód odrzucenia." };
  }

  const leavingSigned = row.assignment.status === "zapisana" && status !== "zapisana";
  if (leavingSigned) {
    if (scope.kind === "trainer") return { ok: false, status: 409, error: SIGNED_LOCKED_TRAINER };
    if (!scope.canUndoSigned) return { ok: false, status: 403, error: SIGNED_LOCKED_ADMIN };
    if (row.assignment.billingStatus !== "do_zafakturowania" && billingStatus !== "do_zafakturowania") {
      return { ok: false, status: 409, error: SIGNED_LOCKED_BILLED };
    }
  }

  // Maile wysyłamy PO zapisie przydziału, bo `onLeadSigned` czyta z bazy przydział o statusie „zapisana".
  let signed = false;
  const update: Partial<typeof schema.leadAssignments.$inferInsert> = {};

  if (billingStatus) update.billingStatus = billingStatus;
  if (status !== row.assignment.status) {
    update.status = status;
    if (status === "odrzucony") update.rejectionReason = rejectionReason?.trim() || null;
    if (status === "zapisana") {
      // naliczenie: per_zapis -> stawka trenerki; per_lead -> kwota naliczona przy przydziale
      if (row.trainer.billingModel === "per_zapis") update.amount = row.trainer.rate;
      // eskaluj status leada
      await db.update(schema.leads).set({ status: "zapisana" }).where(eq(schema.leads.id, row.assignment.leadId));
      await audit({
        action: "zmiana_statusu",
        entityType: "lead",
        entityId: row.assignment.leadId,
        details: { to: "zapisana", via: `assignment:${assignmentId}` },
      });
      signed = true;
    }
    if (leavingSigned) {
      update.amount = 0;
      const others = await db
        .select({ id: schema.leadAssignments.id })
        .from(schema.leadAssignments)
        .where(
          and(
            eq(schema.leadAssignments.leadId, row.assignment.leadId),
            eq(schema.leadAssignments.status, "zapisana"),
            ne(schema.leadAssignments.id, assignmentId)
          )
        )
        .limit(1);
      const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.id, row.assignment.leadId)).limit(1);
      // Status leada cofamy tylko, gdy żadna inna akademia go nie zapisała i nie jest już rozliczony.
      if (lead && lead.status === "zapisana" && others.length === 0) {
        await db.update(schema.leads).set({ status }).where(eq(schema.leads.id, lead.id));
        await audit({
          action: "zmiana_statusu",
          entityType: "lead",
          entityId: lead.id,
          details: { from: "zapisana", to: status, via: `assignment:${assignmentId}`, undo: true },
        });
      }
      await audit({
        action: "cofniecie_zapisu",
        entityType: "assignment",
        entityId: assignmentId,
        details: { to: status, trainerId: row.trainer.id, clearedAmount: row.assignment.amount },
      });
    }
    await audit({
      action: "zmiana_statusu_przydzialu",
      entityType: "assignment",
      entityId: assignmentId,
      details: { from: row.assignment.status, to: status, trainerId: row.trainer.id },
    });
  }

  if (billingStatus && billingStatus !== row.assignment.billingStatus) {
    await audit({
      action: "zmiana_statusu_platnosci",
      entityType: "assignment",
      entityId: assignmentId,
      details: { from: row.assignment.billingStatus, to: billingStatus, trainerId: row.trainer.id, amount: row.assignment.amount },
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
      .where(eq(schema.leadAssignments.id, assignmentId))
      .returning();
  }

  if (signed) {
    await deps.onSigned({
      leadId: row.assignment.leadId,
      assignmentId,
      trainerName: row.trainer.name,
      actor: statusActorLabel(user),
    });
  }

  return { ok: true, assignment: updated };
}

/** Wejście trenerki (panel, telefon, CRM) — wąski wrapper na wspólny rdzeń. */
export async function updateTrainerAssignmentStatusCore(
  db: AnyDb,
  params: {
    user: StatusActor;
    trainerId: number;
    assignmentId: number;
    input: AssignmentStatusInput;
  },
  deps: { onSigned: OnSigned; audit?: AuditFn }
): Promise<AssignmentStatusResult> {
  return changeAssignmentStatusCore(
    db,
    {
      user: params.user,
      assignmentId: params.assignmentId,
      scope: { kind: "trainer", trainerId: params.trainerId },
      change: { status: params.input.status, rejectionReason: params.input.rejectionReason },
    },
    deps
  );
}
