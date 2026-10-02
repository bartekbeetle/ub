import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getDb } from "@/db";
import { requireSuperadmin, hashPassword } from "@/lib/auth";
import { logAdminAction } from "@/lib/audit";
import { applyTeamAction } from "@/lib/team";
import { teamActionSchema, zodErrorMessage } from "@/lib/validators";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

const ACTION_LOG = {
  disable: "zespol_admin_wylaczony",
  enable: "zespol_admin_wlaczony",
  revoke: "zespol_admin_dostep_odebrany",
  reset_password: "zespol_admin_haslo_zresetowane",
} as const;

/**
 * Wyłączenie / włączenie / odebranie dostępu / reset hasła konta admina.
 * Reguły (superadmin nietykalny, ostatni superadmin chroniony) siedzą w `@/lib/team`,
 * żeby test sprawdzał dokładnie ten sam kod, który wykonuje się tutaj.
 */
export async function PATCH(req: Request, { params }: { params: Params }) {
  const user = await requireSuperadmin();
  if (!user) return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });

  const { id } = await params;
  const targetId = Number(id);
  if (!Number.isInteger(targetId)) return NextResponse.json({ error: "Nieprawidłowe ID." }, { status: 400 });

  const parsed = teamActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });

  let password: string | undefined;
  let passwordHash: string | undefined;
  if (parsed.data.action === "reset_password") {
    const typed = parsed.data.password?.trim() ?? "";
    if (typed && typed.length < 10) {
      return NextResponse.json({ error: "Hasło tymczasowe musi mieć min. 10 znaków." }, { status: 400 });
    }
    password = typed || randomBytes(18).toString("base64url");
    passwordHash = await hashPassword(password);
  }

  const res = await applyTeamAction(await getDb(), targetId, parsed.data.action, { passwordHash });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  await logAdminAction(user, {
    action: ACTION_LOG[parsed.data.action],
    entityType: "user",
    entityId: targetId,
    details: { email: res.data.email },
  });
  return NextResponse.json({ ok: true, ...(password ? { password } : {}) });
}
