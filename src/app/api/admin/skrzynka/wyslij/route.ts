import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getInboxMessage, inboxConfigured, sendFromInbox } from "@/lib/inbox";
import { logAudit, actorLabel } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  to: z.string().trim().email("Podaj poprawny adres e-mail").max(255),
  subject: z.string().trim().min(1, "Temat nie może być pusty").max(300),
  text: z.string().trim().min(1, "Treść nie może być pusta").max(20_000),
  /** UID wiadomości w INBOX, na którą odpowiadamy. Nagłówki wątku bierzemy z serwera, nie od klienta. */
  replyToUid: z.number().int().positive().optional(),
});

/** Wysyłka z `biuro@` — odpowiedź na maila albo nowa wiadomość do kursantki. */
export async function POST(req: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
  if (!inboxConfigured()) {
    return NextResponse.json({ error: "Skrzynka nieskonfigurowana (INBOX_USER / INBOX_PASS)." }, { status: 503 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Nieprawidłowe dane." }, { status: 400 });
  }
  const { to, subject, text, replyToUid } = parsed.data;

  try {
    let inReplyTo: string | null = null;
    let references: string[] = [];
    if (replyToUid) {
      const original = await getInboxMessage("odebrane", replyToUid);
      if (original?.messageId) {
        inReplyTo = original.messageId;
        references = [...original.references, original.messageId];
      }
    }
    await sendFromInbox({ to, subject, text, inReplyTo, references, answeredUid: replyToUid });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[inbox] Błąd wysyłki:", err);
    return NextResponse.json({ error: `Nie wysłano: ${message}` }, { status: 502 });
  }

  await logAudit({
    actor: actorLabel(user),
    action: replyToUid ? "skrzynka_odpowiedz" : "skrzynka_wyslij",
    entityType: "email",
    entityId: replyToUid ?? null,
    details: { to, subject },
  });

  return NextResponse.json({ ok: true });
}
