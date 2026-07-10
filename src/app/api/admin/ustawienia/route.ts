import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";
import { settingsSchema } from "@/lib/validators";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  return NextResponse.json(await getSettings());
}

export async function PATCH(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const parsed = settingsSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Nieprawidłowe dane." }, { status: 400 });
  }
  await getSettings(); // upewnij się, że wiersz istnieje
  const db = await getDb();
  const [updated] = await db.update(schema.settings).set(parsed.data).where(eq(schema.settings.id, 1)).returning();
  await logAudit({ actor: actorLabel(user), action: "ustawienia_zmienione", entityType: "settings", entityId: 1, details: parsed.data });
  return NextResponse.json(updated);
}
