/**
 * Rdzeń dziennika działań administracji — bez `server-only` i bez singletona bazy,
 * żeby dało się go przetestować na PGlite (`scripts/test-superadmin.ts`).
 * W aplikacji wołaj `logAdminAction` z `@/lib/audit`.
 */
import { desc, eq, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDb = PgDatabase<any, typeof schema>;

export type AdminActionParams = {
  action: string;
  entityType: string;
  entityId?: number | null;
  details?: Record<string, unknown>;
};

export async function writeAdminAudit(
  db: AnyDb,
  actor: { id: number; role: string } | null,
  params: AdminActionParams,
): Promise<void> {
  await db.insert(schema.adminAuditLog).values({
    actorUserId: actor?.id ?? null,
    actorRole: actor?.role ?? "system",
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    details: params.details ?? {},
  });
}

export const AUDIT_PAGE_SIZE = 50;

/** Strona dziennika, najnowsze na górze; opcjonalny filtr po koncie. */
export async function readAdminAudit(db: AnyDb, opts: { actorUserId?: number | null; page?: number }) {
  const page = Math.max(1, opts.page ?? 1);
  const where = opts.actorUserId ? eq(schema.adminAuditLog.actorUserId, opts.actorUserId) : undefined;
  const rows = await db
    .select({ entry: schema.adminAuditLog, actorEmail: schema.users.email })
    .from(schema.adminAuditLog)
    .leftJoin(schema.users, eq(schema.adminAuditLog.actorUserId, schema.users.id))
    .where(where)
    .orderBy(desc(schema.adminAuditLog.createdAt), desc(schema.adminAuditLog.id))
    .limit(AUDIT_PAGE_SIZE)
    .offset((page - 1) * AUDIT_PAGE_SIZE);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.adminAuditLog)
    .where(where);
  return { rows, total: n, page, pageSize: AUDIT_PAGE_SIZE };
}

