import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getDb } from "@/db";
import { requireSuperadmin, hashPassword } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";
import { createAdminUser, listTeam } from "@/lib/team";
import { teamCreateSchema, zodErrorMessage } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireSuperadmin();
  if (!user) return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });
  return NextResponse.json(await listTeam(await getDb()));
}

/** Tworzy konto admina. Hasło tymczasowe pokazujemy RAZ — w bazie ląduje wyłącznie hash. */
export async function POST(req: Request) {
  const user = await requireSuperadmin();
  if (!user) return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });

  const parsed = teamCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });

  const typed = parsed.data.password?.trim() ?? "";
  if (typed && typed.length < 10) {
    return NextResponse.json({ error: "Hasło tymczasowe musi mieć min. 10 znaków." }, { status: 400 });
  }
  const password = typed || randomBytes(18).toString("base64url");

  const res = await createAdminUser(await getDb(), {
    email: parsed.data.email,
    passwordHash: await hashPassword(password),
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  await logAdminAction(user, {
    action: "zespol_admin_utworzony",
    entityType: "user",
    entityId: res.data.id,
    details: { email: res.data.email },
  });
  return NextResponse.json({ ...res.data, password }, { status: 201 });
}
