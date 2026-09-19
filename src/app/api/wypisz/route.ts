import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/marketing-list";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Wypisanie z mailingu — przyjmuje POST z formularza na `/wypisz/[token]`.
 *
 * Świadomie POST, nie GET: skanery antyspamowe otwierają linki z wiadomości, więc wypisanie
 * przez samo wejście na adres kasowałoby ludzi z listy bez ich udziału.
 *
 * Obsługuje `application/x-www-form-urlencoded` (formularz bez JS — klient pocztowy bywa
 * prymitywny i rezygnacja musi działać zawsze) oraz JSON, gdyby wołał to panel.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const contentType = req.headers.get("content-type") ?? "";
  // Token z query obsługuje przycisk „Wypisz" w Gmailu/Outlooku (RFC 8058, One-Click):
  // klient pocztowy wysyła POST na adres z nagłówka List-Unsubscribe, bez żadnego formularza.
  let token = url.searchParams.get("token") ?? "";

  if (!token) {
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => null);
      token = typeof body?.token === "string" ? body.token : "";
    } else {
      const form = await req.formData().catch(() => null);
      token = String(form?.get("token") ?? "");
    }
  }

  if (!token) {
    return NextResponse.json({ error: "Brak tokenu." }, { status: 400 });
  }

  const result = await unsubscribeByToken(token, "link");

  if (!result) {
    // Nie zdradzamy, czy token istnieje — ale i tak wracamy na stronę, która powie
    // po ludzku, że odnośnik jest nieznany.
    return NextResponse.redirect(new URL(`/wypisz/${encodeURIComponent(token)}`, req.url), 303);
  }

  if (!result.alreadyOptedOut) {
    await logAudit({
      actor: "system",
      action: "wypisanie_z_mailingu",
      entityType: "marketing_suppression",
      entityId: 0,
      // Adres jest tu potrzebny jako dowód realizacji sprzeciwu (art. 21 RODO) —
      // musimy umieć wykazać, KTO i KIEDY się wypisał.
      details: { email: result.email, source: "link" },
    });
  }

  // 303 — po POST wracamy GET-em, żeby odświeżenie strony nie wysyłało formularza ponownie.
  return NextResponse.redirect(new URL(`/wypisz/${encodeURIComponent(token)}?ok=1`, req.url), 303);
}
