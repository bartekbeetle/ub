import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { sendTestEmail } from "@/lib/email";
import { logAudit, actorLabel } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  to: z.string().trim().email("Podaj poprawny adres email").max(255),
});

/**
 * Wysyłka testowego maila z panelu admina — sprawdza konfigurację SMTP, zanim
 * pierwsza kursantka dostanie (albo nie dostanie) wiadomość.
 *
 * Celowo NIE przechodzi przez `email_queue`: to diagnostyka, a nie korespondencja
 * z leadem, i nie ma powodu zaśmiecać nią historii wysyłek.
 * Adres podaje admin ręcznie — nigdy nie wysyłamy testu na adres kursantki.
 */
export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Nieprawidłowe dane." }, { status: 400 });
  }

  const result = await sendTestEmail(parsed.data.to);

  await logAudit({
    actor: actorLabel(user),
    action: "test_smtp",
    entityType: "settings",
    entityId: 1,
    details: { to: parsed.data.to, ok: result.ok, error: result.error ?? null },
  });

  // 200 nawet przy błędzie wysyłki — żądanie się powiodło, to SMTP zawiódł.
  // Panel pokazuje wtedy surowy komunikat, bo tylko on mówi, co realnie poprawić.
  return NextResponse.json(result);
}
