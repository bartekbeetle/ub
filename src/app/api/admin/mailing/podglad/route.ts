import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { zodErrorMessage } from "@/lib/validators";
import { previewMessage } from "@/lib/mailing";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(50000),
});

/**
 * Podgląd wiadomości DOKŁADNIE w postaci, w jakiej wyjdzie: z podstawionymi zmiennymi
 * i z doklejoną stopką rezygnacji. Gdyby podgląd pokazywał samą treść z edytora,
 * admin zatwierdzałby coś innego niż to, co dostaje kursantka.
 *
 * Adres w linku rezygnacji to nasz adres powiadomień — podgląd nie tworzy tokenu
 * dla przypadkowej kursantki.
 */
export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 });
  }

  const settings = await getSettings();
  const preview = await previewMessage({
    subject: parsed.data.subject,
    body: parsed.data.body,
    previewTo: settings.notifyEmail || user.email,
  });

  return NextResponse.json(preview);
}
