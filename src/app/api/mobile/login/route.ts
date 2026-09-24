import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { loginSchema } from "@/lib/validators";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/auth";
import { createMobileSession } from "@/lib/mobile-auth";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Logowanie z aplikacji mobilnej. Różnica wobec `/api/panel/login` jest jedna:
 * zamiast ustawiać cookie, oddajemy surowy token sesji, który telefon trzyma
 * w bezpiecznym magazynie systemu. Reguły dostępu identyczne.
 *
 * Osobny licznik prób (`mobile-login:`), żeby próby z telefonu nie zużywały
 * limitu panelu webowego i odwrotnie.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimit(`mobile-login:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "Zbyt wiele prób logowania. Odczekaj minutę." }, { status: 429 });
  }

  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Podaj email i hasło." }, { status: 400 });

  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, parsed.data.email.toLowerCase()))
    .limit(1);
  const user = rows[0];
  // Stałoczasowo: jedno porównanie bcrypt zawsze (atrapa gdy konta nie ma) — patrz /panel/login.
  const passwordOk = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !user.isActive || !passwordOk) {
    return NextResponse.json({ error: "Nieprawidłowy email lub hasło." }, { status: 401 });
  }
  if (user.role !== "trenerka" || !user.trainerId) {
    return NextResponse.json({ error: "Aplikacja jest dla akademii partnerskich. To konto nie ma dostępu." }, { status: 403 });
  }

  const [trainer] = await db
    .select()
    .from(schema.trainers)
    .where(eq(schema.trainers.id, user.trainerId))
    .limit(1);

  const { token, expiresAt } = await createMobileSession(user.id);
  await logAudit({
    actor: `user:${user.id} ${user.email}`,
    action: "logowanie_mobile",
    entityType: "user",
    entityId: user.id,
  });

  return NextResponse.json({
    token,
    expiresAt: expiresAt.toISOString(),
    mustChangePassword: user.mustChangePassword,
    trainer: {
      name: trainer?.name ?? "",
      isActive: Boolean(trainer?.isActive),
      billingModel: trainer?.billingModel ?? "per_zapis",
      rate: trainer?.rate ?? 0,
    },
  });
}
