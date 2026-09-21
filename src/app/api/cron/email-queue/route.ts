import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
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
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("key") ?? "";
  // Porównanie stałoczasowe — `!==` zdradzałoby sekret znak-po-znaku przez pomiar czasu.
  // Ryzyko było znikome (sekret jest długi i losowy), ale to jedna linia zgodna z dobrą praktyką.
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  }

  // Domyślnie pomijamy maile starsze niż 7 dni (zaległości sprzed konfiguracji SMTP —
  // patrz DEFAULT_MAX_EMAIL_AGE_DAYS). `?maxAgeDays=0` wysyła wszystko, świadomie.
  const rawAge = url.searchParams.get("maxAgeDays");
  const maxAgeDays = rawAge === null ? undefined : Number(rawAge) === 0 ? null : Number(rawAge);
  const limit = Number(url.searchParams.get("limit") || 50);

  const result =
    maxAgeDays === undefined ? await flushEmailQueue(limit) : await flushEmailQueue(limit, maxAgeDays);

  if (result.skipped) {
    return NextResponse.json({
      ok: false,
      reason: "SMTP nieskonfigurowane (SMTP_HOST / SMTP_USER / SMTP_PASS) — kolejka nietknięta.",
    });
  }

  return NextResponse.json({ ok: true, ...result });
}
