import "server-only";
import { getDb } from "@/db";
import { onLeadSigned } from "@/lib/lead-events";
import {
  assignmentStatusSchema,
  updateTrainerAssignmentStatusCore,
  type AssignmentStatusInput,
  type AssignmentStatusResult,
} from "@/lib/assignment-status-core";
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
