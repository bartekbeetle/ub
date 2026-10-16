import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { logAdminAction } from "@/lib/audit";

export const runtime = "nodejs";

/** Włącznik śledzenia otwarć i kliknięć (pulpit mailera). */
export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const parsed = z.object({ enabled: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });

  await getSettings(); // zakłada wiersz ustawień, jeśli go brak
  const db = await getDb();
  await db.update(schema.settings).set({ trackingEnabled: parsed.data.enabled }).where(eq(schema.settings.id, 1));
  await logAdminAction(user, { action: "mailing_sledzenie", entityType: "settings", details: { enabled: parsed.data.enabled } });
  return NextResponse.json({ ok: true, enabled: parsed.data.enabled });
}
