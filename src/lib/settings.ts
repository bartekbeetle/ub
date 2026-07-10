import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Settings } from "@/db/schema";

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.id, 1)).limit(1);
  if (rows[0]) return rows[0];
  const inserted = await db.insert(schema.settings).values({ id: 1 }).returning();
  return inserted[0];
}
