import { createHmac, timingSafeEqual } from "node:crypto";
import type { SmsProvider, SmsSendResult } from "@/lib/sms/types";

/**
 * Sterownik „SMS Gateway for Android" (capcom6/android-sms-gateway) w trybie Cloud —
 * https://github.com/capcom6/android-sms-gateway (README „Cloud Server", sprawdzone 08.10.2026).
 *
 * SMS wychodzi z karty SIM w telefonie, więc rozmówca widzi numer telefonu UB.
 * - `POST https://api.sms-gate.app/3rdparty/v1/message`, Basic auth (login/hasło z ekranu
 *   głównego aplikacji), body `{ textMessage: { text }, phoneNumbers: ["+48…"] }`.
 * - Odpowiedź niesie `id` wiadomości; statusy (sent/delivered/failed) wracają webhookami.
 * - Treść wiadomości przechodzi przez serwery sms-gate.app (tryb Cloud). Pełna lokalność
 *   wymagałaby własnego serwera pośredniczącego („Private Server") — świadomie odłożone.
 * - `SMSGATE_URL` pozwala podmienić bazowy adres (np. na własny serwer).
 */
const DEFAULT_BASE = "https://api.sms-gate.app/3rdparty/v1";
const TIMEOUT_MS = 10_000;

export function smsgateConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.SMSGATE_USER?.trim() && env.SMSGATE_PASSWORD?.trim());
}

export class SmsgateProvider implements SmsProvider {
  readonly name = "smsgate";
  constructor(
    private readonly user: string,
    private readonly password: string,
    private readonly baseUrl: string = DEFAULT_BASE,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async send(to: string, text: string): Promise<SmsSendResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await this.fetchFn(`${this.baseUrl.replace(/\/$/, "")}/message`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.user}:${this.password}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ textMessage: { text }, phoneNumbers: [to] }),
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
      if (res.status === 401 || res.status === 403) {
        return { id: null, status: "failed", error: "Bramka odrzuciła login lub hasło (SMSGATE_USER / SMSGATE_PASSWORD)." };
      }
      if (!res.ok || !json?.id) {
        return {
          id: null,
          status: "failed",
          error: `Bramka SMS: HTTP ${res.status}${json?.message ? ` — ${json.message}` : ""}.`,
        };
      }
      return { id: String(json.id), status: "sent" };
    } catch (err) {
      return {
        id: null,
        status: "failed",
        error: err instanceof Error ? `Błąd połączenia z bramką SMS: ${err.message}` : "Błąd połączenia z bramką SMS.",
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Bez loginu i hasła → tryb testowy: nic nie wychodzi, wiadomość zapisuje się jako „dry-run". */
export function getTelefonSmsProvider(env: Record<string, string | undefined> = process.env): SmsProvider {
  if (!smsgateConfigured(env)) {
    return {
      name: "dryrun",
      async send(to, text) {
        console.log(`[telefon:dry-run] do ${to.slice(0, 5)}… (${text.length} znaków) — nie wysłano`);
        return { id: null, status: "dry-run" };
      },
    };
  }
  return new SmsgateProvider(env.SMSGATE_USER!.trim(), env.SMSGATE_PASSWORD!.trim(), env.SMSGATE_URL?.trim() || undefined);
}

/**
 * Podpis webhooka: HMAC-SHA256 z (surowe ciało + X-Timestamp), klucz = „Signing Key"
 * z ustawień aplikacji (README docs.sms-gate.app/features/webhooks → „Payload Signing").
 * Odrzucamy też zbyt stare żądania (replay) — okno 5 min.
 */
export function verifyWebhookSignature(
  key: string,
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  nowSec: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!key || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSec - ts) > 300) return false;
  const expected = createHmac("sha256", key).update(rawBody + timestamp).digest("hex");
  const sig = signature.trim().toLowerCase();
  if (sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
}
