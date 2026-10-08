import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { telefonEnabled } from "@/lib/telefon/flag";
import { CALL_OUTCOMES, logCall } from "@/lib/telefon/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().trim().min(1).max(40),
  outcome: z.enum(CALL_OUTCOMES),
  note: z.string().trim().max(2000).optional(),
});

/** Zapis wyniku rozmowy — jedno tapnięcie po tym, jak telefon skończył dzwonić. */
export async function POST(req: Request) {
  if (!telefonEnabled()) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  const res = await logCall(user, parsed.data.phone, parsed.data.outcome, parsed.data.note ?? null);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}
