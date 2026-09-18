import { NextResponse } from "next/server";
import { flushEmailQueue } from "@/lib/email";

export const runtime = "nodejs";
// Kolejka ma być opróżniana na żądanie, nigdy z cache'u odpowiedzi.
export const dynamic = "force-dynamic";

/**
 * Opróżnianie kolejki maili.
 *
 * Po co osobny worker, skoro `sendOrQueueEmail` próbuje wysłać od razu:
 *  - maile zebrane, ZANIM ustawiono SMTP, inaczej zostałyby w bazie na zawsze
 *    (dokładnie ta sytuacja: kolejka rosła od lipca, bo SMTP nigdy nie skonfigurowano),
 *  - chwilowe awarie serwera pocztowego — ponawiamy do MAX_EMAIL_ATTEMPTS.
 *
 * Zabezpieczenie: nagłówek `Authorization: Bearer <CRON_SECRET>` albo `?key=<CRON_SECRET>`.
 * Gdy `CRON_SECRET` nie jest ustawiony, endpoint jest WYŁĄCZONY (404) — celowo, żeby świeży
 * deploy nie wystawiał publicznie akcji, która wysyła maile do ludzi.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("key");
  if (provided !== secret) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  const result = await flushEmailQueue();
  if (result.skipped) {
    return NextResponse.json({
      ok: false,
      reason: "SMTP nieskonfigurowane (SMTP_HOST / SMTP_USER / SMTP_PASS) — kolejka nietknięta.",
    });
  }

  return NextResponse.json({ ok: true, ...result });
}
