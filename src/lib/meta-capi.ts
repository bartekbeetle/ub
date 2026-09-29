import "server-only";
import { buildMetaCapiPayload, isCapiConfigured, metaCapiEndpoint, type MetaCapiInput } from "./meta-capi-core";

let loggedDisabledOnce = false;

/**
 * Wywołanie sieciowe Meta Conversions API. FIRE-AND-FORGET z punktu widzenia wywołującego
 * (`/api/lead`, `/api/akademia/rejestracja`): woła się to jako `void sendMetaCapiEvent(...).catch(...)`
 * albo owinięte w `after()` z `next/server` (patrz te route'y) — NIGDY z `await` przed
 * `NextResponse.json`, żeby awaria albo wolność Grafu nie dotknęła czasu odpowiedzi `/api/lead`
 * (kryterium akceptacji #5 brief-u).
 *
 * Timeout 3 s: dłużej niż to i tak nic nie da się zrobić z odpowiedzią, która już poszła do
 * przeglądarki — liczy się tylko, żeby nie zostawić wiszącego requestu w Node na produkcji.
 */
export async function sendMetaCapiEvent(input: MetaCapiInput): Promise<void> {
  if (!isCapiConfigured()) {
    if (!loggedDisabledOnce) {
      loggedDisabledOnce = true;
      console.log(
        "[meta-capi] META_CAPI_TOKEN i/lub META_PIXEL_ID nieustawione w środowisku — Conversions API wyłączone (tylko przeglądarkowy Pixel)."
      );
    }
    return;
  }

  const token = process.env.META_CAPI_TOKEN!;
  const pixelId = (process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID)!;
  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim() || undefined;
  const payload = buildMetaCapiPayload({ ...input, testEventCode });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${metaCapiEndpoint(pixelId)}?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[meta-capi] ${input.eventName} — HTTP ${res.status}: ${text.slice(0, 500)}`);
    }
  } catch (err) {
    console.error(`[meta-capi] ${input.eventName} — błąd wysyłki:`, err);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * `_fbp`/`_fbc` (cookies pikselu), IP i User-Agent — czytane z żądania, które i tak przyszło
 * z tej samej przeglądarki co formularz. `event_source_url` z nagłówka `Referer`: to jest
 * strona, z której poleciał fetch do `/api/lead` — dokładnie to, czego chce pole Mety.
 */
export function extractMetaClientSignals(req: Request): {
  fbp?: string;
  fbc?: string;
  userAgent?: string;
  eventSourceUrl?: string;
} {
  const cookieHeader = req.headers.get("cookie") || "";
  const fbp = /(?:^|;\s*)_fbp=([^;]+)/.exec(cookieHeader)?.[1];
  const fbc = /(?:^|;\s*)_fbc=([^;]+)/.exec(cookieHeader)?.[1];
  return {
    fbp,
    fbc,
    userAgent: req.headers.get("user-agent") || undefined,
    eventSourceUrl: req.headers.get("referer") || undefined,
  };
}
