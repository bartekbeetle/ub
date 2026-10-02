import "server-only";
import { getDb, schema } from "@/db";
import type { User } from "@/db/schema";
import { writeAdminAudit } from "@/lib/admin-audit-core";

export function actorLabel(user: User | null): string {
  return user ? `user:${user.id} ${user.email}` : "system";
}

export async function logAudit(params: {
  actor: string;
  action: string;
  entityType: string;
  entityId?: number | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  const db = await getDb();
  await db.insert(schema.auditLog).values({
    actor: params.actor,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    details: params.details ?? {},
  });
}

/**
 * Dziennik działań administracji (`admin_audit_log`, czyta go superadmin w /admin/zespol/log).
 * Zapisuje też wpis do ogólnego `audit_log` — historia przy leadzie (kursantki/[id]) czyta
 * stamtąd i nie może stracić wpisów po wprowadzeniu nowej tabeli.
 * Błąd zapisu dziennika NIE przerywa akcji admina (mutacja już poszła); trafia do konsoli.
 */
export async function logAdminAction(
  user: User,
  params: { action: string; entityType: string; entityId?: number | null; details?: Record<string, unknown> },
): Promise<void> {
  try {
    await logAudit({ actor: actorLabel(user), ...params });
    await writeAdminAudit(await getDb(), user, params);
  } catch (err) {
    console.error("[admin-audit] zapis dziennika nie powiódł się:", err);
  }
}
