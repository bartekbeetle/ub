import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireSuperadmin } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";
import { settingsSchema } from "@/lib/validators";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireSuperadmin();
  if (!user) return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  return NextResponse.json(await getSettings());
}

export async function PATCH(req: Request) {
  const user = await requireSuperadmin();
  if (!user) return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  const parsed = settingsSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Nieprawidłowe dane." }, { status: 400 });
  }
  await getSettings(); // upewnij się, że wiersz istnieje
  const db = await getDb();
  const [updated] = await db.update(schema.settings).set(parsed.data).where(eq(schema.settings.id, 1)).returning();
  await logAdminAction(user, { action: "ustawienia_zmienione", entityType: "settings", entityId: 1, details: parsed.data });
  return NextResponse.json(updated);
}
