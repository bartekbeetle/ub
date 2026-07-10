import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { loginSchema } from "@/lib/validators";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { verifyPassword, createSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimit(`login:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "Zbyt wiele prób logowania. Odczekaj minutę." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Podaj email i hasło." }, { status: 400 });

  const db = await getDb();
  const rows = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data.email.toLowerCase())).limit(1);
  const user = rows[0];
  const valid = user && user.isActive && (await verifyPassword(parsed.data.password, user.passwordHash));
  if (!valid) {
    return NextResponse.json({ error: "Nieprawidłowy email lub hasło." }, { status: 401 });
  }

  await createSession(user.id); // rotacja: nowa sesja przy każdym logowaniu
  await logAudit({ actor: `user:${user.id} ${user.email}`, action: "logowanie", entityType: "user", entityId: user.id });

  return NextResponse.json({ ok: true, mustChangePassword: user.mustChangePassword, role: user.role });
}
