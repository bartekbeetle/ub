import "server-only";
import { getDb, schema } from "@/db";
import type { User } from "@/db/schema";

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
