import { NextResponse } from "next/server";
import { telefonEnabled } from "@/lib/telefon/flag";
import { verifyWebhookSignature } from "@/lib/telefon/smsgate";
import { recordInboundSms, updateOutboundStatus } from "@/lib/telefon/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Incoming = { messageId?: string; message?: string; sender?: string; reason?: string };
type Hook = { event?: string; payload?: Incoming & { messages?: Incoming[] } };

/**
 * Webhook aplikacji SMS Gateway (odpowiedzi kursantek + statusy wysłanych SMS-ów).
 * Publiczny adres, więc KAŻDE żądanie musi mieć poprawny podpis HMAC (klucz = „Signing Key"
 * z aplikacji → `SMSGATE_WEBHOOK_KEY`). Bez klucza w env endpoint odrzuca wszystko.
 * Ciało czytamy jako surowy tekst — podpis liczy się z bajtów, nie ze sparsowanego JSON-a.
 */
export async function POST(req: Request) {
  if (!telefonEnabled()) return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  const key = process.env.SMSGATE_WEBHOOK_KEY?.trim() ?? "";
  const raw = await req.text();
  if (raw.length > 100_000) return NextResponse.json({ error: "Za duże." }, { status: 413 });
  if (!verifyWebhookSignature(key, raw, req.headers.get("x-timestamp"), req.headers.get("x-signature"))) {
    return NextResponse.json({ error: "Zły podpis." }, { status: 401 });
  }

  let hook: Hook;
  try {
    hook = JSON.parse(raw) as Hook;
  } catch {
    return NextResponse.json({ error: "Nieczytelne ciało." }, { status: 400 });
  }
  const p = hook.payload ?? {};

  switch (hook.event) {
    case "sms:received":
      if (p.sender && p.message) await recordInboundSms(p.sender, p.message, p.messageId ?? null);
      break;
    case "sms:batch:received":
      for (const m of p.messages ?? []) {
        if (m.sender && m.message) await recordInboundSms(m.sender, m.message, m.messageId ?? null);
      }
      break;
    case "sms:sent":
      if (p.messageId) await updateOutboundStatus(p.messageId, "wyslany");
      break;
    case "sms:delivered":
      if (p.messageId) await updateOutboundStatus(p.messageId, "dostarczony");
      break;
    case "sms:failed":
      if (p.messageId) await updateOutboundStatus(p.messageId, "blad", p.reason ?? "Telefon nie wysłał wiadomości.");
      break;
    default:
      break; // inne zdarzenia (ping, app:started…) — potwierdzamy i ignorujemy
  }
  return NextResponse.json({ ok: true });
}
