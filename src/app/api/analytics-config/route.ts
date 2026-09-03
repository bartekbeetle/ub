import { NextResponse } from "next/server";

export const runtime = "nodejs";
// force-dynamic: identyfikatory czytamy przy KAŻDYM żądaniu, nie przy buildzie.
export const dynamic = "force-dynamic";

/**
 * Identyfikatory analityki podawane w RUNTIME.
 *
 * Powód istnienia tego endpointu: `NEXT_PUBLIC_*` w komponencie klienckim jest podmieniane
 * na wartość podczas `next build`. W obrazie dockerowym build leci bez zmiennych aplikacji
 * (Coolify wstrzykuje je dopiero do kontenera), więc `process.env.NEXT_PUBLIC_GA4_ID` w
 * przeglądarce zawsze wychodziło `undefined` i analityka nigdy się nie ładowała — nawet po
 * poprawnym ustawieniu zmiennej w panelu. Zweryfikowane 03.09.2026 na produkcyjnym chunku
 * `app/layout-*.js`: `let o=c.env.NEXT_PUBLIC_META_PIXEL_ID,u=c.env.NEXT_PUBLIC_GA4_ID`,
 * gdzie `c.env` jest w przeglądarce pustym obiektem.
 *
 * Dzięki temu endpointowi zmiana ID wymaga tylko restartu kontenera, nie przebudowy obrazu.
 * `NEXT_PUBLIC_*` zostaje obsługiwane jako fallback (gdyby ktoś jednak zbudował z build-argami).
 *
 * Endpoint NIE ustawia cookies i nie zbiera danych — sam identyfikator pomiarowy jest jawny
 * (i tak trafia do HTML-a). Skrypty odpalają się dopiero po zgodzie, po stronie klienta.
 */
export async function GET() {
  return NextResponse.json(
    {
      ga4Id: process.env.GA4_ID || process.env.NEXT_PUBLIC_GA4_ID || null,
      pixelId: process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID || null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
