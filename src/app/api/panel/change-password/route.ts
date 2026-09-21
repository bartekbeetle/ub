import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { changePasswordSchema } from "@/lib/validators";
import { requireTrainer, verifyPassword, hashPassword, invalidateUserSessions, createSession } from "@/lib/auth";
import { logAudit, actorLabel } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // allowPasswordChange: trenerka z hasłem startowym MUSI móc je tu zmienić — to jedyna
  // trasa, na której `mustChangePassword` nie blokuje dostępu.
  const user = await requireTrainer({ allowPasswordChange: true });
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

  const parsed = changePasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Nieprawidłowe dane." }, { status: 400 });
  }
  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "Obecne hasło jest nieprawidłowe." }, { status: 400 });
  }

  const db = await getDb();
  await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(parsed.data.newPassword), mustChangePassword: false })
    .where(eq(schema.users.id, user.id));

  // Unieważnij wszystkie sesje po zmianie hasła; bieżące urządzenie dostaje świeżą.
  await invalidateUserSessions(user.id);
  await createSession(user.id);

  await logAudit({ actor: actorLabel(user), action: "zmiana_hasla", entityType: "user", entityId: user.id });
  return NextResponse.json({ ok: true });
}
