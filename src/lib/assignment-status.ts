import "server-only";
import { getDb } from "@/db";
import { onLeadSigned } from "@/lib/lead-events";
import {
  assignmentStatusSchema,
  changeAssignmentStatusCore,
  updateTrainerAssignmentStatusCore,
  type StatusChange,
  type AssignmentStatusInput,
  type AssignmentStatusResult,
} from "@/lib/assignment-status-core";
import { logAdminAction } from "@/lib/audit";
import { isSuperadminRole } from "@/lib/roles";
import type { User } from "@/db/schema";

/**
 * ZMIANA STATUSU WŁASNEGO PRZYDZIAŁU PRZEZ TRENERKĘ — jedno miejsce dla panelu, telefonu i CRM.
 *
 * Logika (izolacja po trainerId, bramka onboardingu, naliczenie należności, maile) mieszka
 * w `assignment-status-core.ts`, żeby dała się testować na PGlite. Tu jest tylko wiring
 * na prawdziwą bazę i prawdziwe maile. Powód istnienia jednej kopii: przejście na „zapisana"
 * nalicza należność — dwie kopie rozjechałyby się przy pierwszej zmianie cennika.
 */

export { assignmentStatusSchema };
export type { AssignmentStatusInput, AssignmentStatusResult };

export async function updateTrainerAssignmentStatus(params: {
  user: User;
  trainerId: number;
  assignmentId: number;
  input: AssignmentStatusInput;
}): Promise<AssignmentStatusResult> {
  const db = await getDb();
  return updateTrainerAssignmentStatusCore(db, params, {
    onSigned: (p) => onLeadSigned(p),
  });
}

/**
 * Wejście ADMINA (`PATCH /api/admin/assignments/[id]`) — ten sam rdzeń, inny zakres:
 * dowolny przydział, bez bramki onboardingu, audyt przez `logAdminAction` (audit_log + admin_audit_log).
 * Cofnięcie „zapisana" tylko dla superadmina; zmianę `billingStatus` pilnuje trasa (stripBilling/403).
 */
export async function updateAssignmentStatusAsAdmin(params: {
  user: User;
  assignmentId: number;
  change: StatusChange;
}): Promise<AssignmentStatusResult> {
  const db = await getDb();
  return changeAssignmentStatusCore(
    db,
    {
      user: params.user,
      assignmentId: params.assignmentId,
      scope: { kind: "admin", canUndoSigned: isSuperadminRole(params.user.role) },
      change: params.change,
    },
    {
      onSigned: (p) => onLeadSigned(p),
      audit: (p) => logAdminAction(params.user, p),
    }
  );
}
