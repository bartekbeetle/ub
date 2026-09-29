/**
 * Meta Conversions API — logika CZYSTA (hash, budowa payloadu, decyzja czy wysyłać).
 * ŚWIADOMIE bez `"server-only"` i bez `fetch`: ten plik musi dać się zaimportować
 * z `scripts/test-tracking.ts` (uruchamiane przez `tsx`, poza Next.js), żeby testować
 * hashowanie i kształt payloadu BEZ sieci i BEZ configu Next. Wywołanie HTTP jest
 * w `src/lib/meta-capi.ts` (tamten plik ma `"server-only"` — woła go tylko API route).
 */
import { createHash } from "node:crypto";
import { normalizeEmail, normalizePhoneDigits } from "./tracking-format";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Meta chce e-mail i telefon zahaszowane SHA-256, po normalizacji (dok. Meta: trim+lowercase
 * dla e-maila, same cyfry z kierunkowym dla telefonu — bez `+`). */
export function hashEmail(email: string): string {
  return sha256Hex(normalizeEmail(email));
}

export function hashPhone(phone: string): string {
  return sha256Hex(normalizePhoneDigits(phone));
}

/**
 * Wersja Graph API dla Conversions API. Domyślnie `v23.0` (wydana 29.05.2025, wygasa
 * 08.10.2027 — sprawdzone 29.09.2026 na `developers.facebook.com/docs/graph-api/changelog/versions`).
 * Najnowsza w chwili pisania: v26.0 (29.07.2026). Wybrano v23.0 zamiast najnowszej: to
 * projekt, który Bartek odpala w cyklach binge i może nie dotykać miesiącami — v23.0 ma
 * dłuższy zapas do wygaśnięcia niż v21 (a nowsze wersje bywają świeżo wydane i mniej
 * przetestowane w bibliotekach trzecich). Nadpisywalne przez `META_CAPI_API_VERSION`,
 * gdyby CEO chciał ręcznie wymusić inną — patrz `docs/zdarzenia-analityczne.md`.
 */
export const DEFAULT_META_API_VERSION = "v23.0";

export function metaApiVersion(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.META_CAPI_API_VERSION?.trim();
  return override || DEFAULT_META_API_VERSION;
}

export function metaCapiEndpoint(pixelId: string, env: NodeJS.ProcessEnv = process.env): string {
  return `https://graph.facebook.com/${metaApiVersion(env)}/${pixelId}/events`;
}

/** CAPI jest wyłączone, dopóki brakuje TOKENU albo ID PIXELA — jeden bez drugiego nie działa. */
export function isCapiConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const hasToken = Boolean(env.META_CAPI_TOKEN && env.META_CAPI_TOKEN.trim());
  const hasPixel = Boolean((env.META_PIXEL_ID || env.NEXT_PUBLIC_META_PIXEL_ID)?.trim());
  return hasToken && hasPixel;
}

/**
 * Decyzja "czy w ogóle próbować wysłać CAPI dla tego zgłoszenia" — NIEZALEŻNA od konfiguracji
 * serwera (`isCapiConfigured`). Dwa warunki, oba wymagane:
 * - `adConsent`: klient zgłosił zgodę marketingową z banera cookies (`readConsent().marketing`,
 *   NIE mylić z `marketingConsent` z formularza — to zgoda na newsletter, inna podstawa prawna).
 * - `eventId`: bez niego nie ma jak zdeduplikować z pikselem przeglądarkowym — serwer NIGDY
 *   nie generuje własnego ID zamiennika, bo to podwoiłoby zdarzenie w raportach Mety.
 */
export function shouldSendCapi(params: { adConsent?: boolean; eventId?: string | null }): boolean {
  return Boolean(params.adConsent && params.eventId);
}

export type MetaCapiEventName = "Lead" | "SubmitApplication";

export interface MetaCapiInput {
  eventName: MetaCapiEventName;
  eventId: string;
  eventSourceUrl: string;
  email: string;
  phone: string;
  clientIp?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
  /** WHITELIST — nigdy nie wrzucaj tu całego wiersza z bazy (ma `employmentStatus`, kod
   * pocztowy itd. — kategorie wrażliwe/PII, których Meta nie może dostać). */
  customData?: Record<string, string | number>;
  testEventCode?: string;
}

export interface MetaCapiPayload {
  data: Array<{
    event_name: string;
    event_time: number;
    event_id: string;
    action_source: "website";
    event_source_url: string;
    user_data: {
      em: string[];
      ph: string[];
      client_ip_address?: string;
      client_user_agent?: string;
      fbp?: string;
      fbc?: string;
    };
    custom_data?: Record<string, string | number>;
  }>;
  test_event_code?: string;
}

/**
 * Buduje payload CAPI — funkcja CZYSTA, zero sieci. `event_time` w SEKUNDACH (nie ms — tak
 * wymaga Graph API). Żadnego surowego e-maila/telefonu w wyniku: oba idą WYŁĄCZNIE zahaszowane.
 */
export function buildMetaCapiPayload(input: MetaCapiInput): MetaCapiPayload {
  return {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: input.eventSourceUrl,
        user_data: {
          em: [hashEmail(input.email)],
          ph: [hashPhone(input.phone)],
          ...(input.clientIp ? { client_ip_address: input.clientIp } : {}),
          ...(input.userAgent ? { client_user_agent: input.userAgent } : {}),
          ...(input.fbp ? { fbp: input.fbp } : {}),
          ...(input.fbc ? { fbc: input.fbc } : {}),
        },
        ...(input.customData ? { custom_data: input.customData } : {}),
      },
    ],
    ...(input.testEventCode ? { test_event_code: input.testEventCode } : {}),
  };
}
