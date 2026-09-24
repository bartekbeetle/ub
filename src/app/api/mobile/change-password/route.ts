import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { changePasswordSchema } from "@/lib/validators";
import { verifyPassword, hashPassword, invalidateUserSessions } from "@/lib/auth";
import { requireTrainerMobile, createMobileSession } from "@/lib/mobile-auth";
import { logAudit, actorLabel } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Zmiana hasła z telefonu.
 *
 * `allowPasswordChange: true` — to JEDYNA trasa mobilna, której nie blokuje
 * `mustChangePassword`. Bez tego pierwsze uruchomienie aplikacji byłoby ślepą uliczką:
 * konto zakładane przez nas ma hasło startowe, logowanie by przeszło, a każde kolejne
 * zapytanie o dane wracało z 401.
 *
 * Po zmianie hasła kasujemy WSZYSTKIE sesje użytkownika (jak w panelu) i od razu
 * wydajemy telefonowi nowy token — inaczej trenerka wylatywałaby z aplikacji
 * natychmiast po ustawieniu własnego hasła.
 */
export async function POST(req: Request) {
  const auth = await requireTrainerMobile(req, { allowPasswordChange: true });
  if (!auth) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

  const parsed = changePasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Nieprawidłowe dane." }, { status: 400 });
  }
  if (!(await verifyPassword(parsed.data.currentPassword, auth.user.passwordHash))) {
    return NextResponse.json({ error: "Obecne hasło jest nieprawidłowe." }, { status: 400 });
  }

  const db = await getDb();
  await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(parsed.data.newPassword), mustChangePassword: false })
    .where(eq(schema.users.id, auth.user.id));

  await invalidateUserSessions(auth.user.id);
  const { token, expiresAt } = await createMobileSession(auth.user.id);

  await logAudit({ actor: actorLabel(auth.user), action: "zmiana_hasla_mobile", entityType: "user", entityId: auth.user.id });
  return NextResponse.json({ ok: true, token, expiresAt: expiresAt.toISOString() });
}
